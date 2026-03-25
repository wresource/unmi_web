import { useDatabase } from '~/server/database'
import { isDropCatchConfigured, fetchDropCatchAuctions, fetchDropCatchDropping } from './dropcatch-api'

// ============================================================================
// Domain Analysis
// ============================================================================

/**
 * Analyze domain name properties
 */
export function analyzeDomain(domainName: string): {
  sld: string; tld: string; length: number;
  hasNumbers: boolean; hasHyphens: boolean;
  isPureLetters: boolean; isPureNumbers: boolean;
} {
  const parts = domainName.split('.')
  const sld = parts[0]
  const tld = parts.slice(1).join('.')
  return {
    sld, tld: '.' + tld,
    length: sld.length,
    hasNumbers: /\d/.test(sld),
    hasHyphens: sld.includes('-'),
    isPureLetters: /^[a-z]+$/i.test(sld),
    isPureNumbers: /^\d+$/.test(sld),
  }
}

// ============================================================================
// Daily Cache Logic
// ============================================================================

/**
 * Check if data needs refresh (once per day).
 * First visitor of the day triggers a refresh; subsequent visitors use cached DB data.
 */
export function needsRefresh(): boolean {
  const db = useDatabase()
  const row = db.prepare(
    "SELECT setting_value FROM notification_settings WHERE account_id = 0 AND setting_key = 'dropcatch_last_refresh'"
  ).get() as { setting_value: string } | undefined

  if (!row) return true

  const lastRefresh = new Date(row.setting_value)
  const now = new Date()
  // Refresh if last refresh was before today
  return lastRefresh.toDateString() !== now.toDateString()
}

/**
 * Mark today as refreshed so subsequent visitors use cached data.
 */
export function markRefreshed(): void {
  const db = useDatabase()
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO notification_settings (account_id, setting_key, setting_value) VALUES (0, 'dropcatch_last_refresh', ?) ON CONFLICT(account_id, setting_key) DO UPDATE SET setting_value = ?"
  ).run(now, now)
}

// ============================================================================
// Main Fetch Function — DropCatch API Only
// ============================================================================

// Mutex to prevent concurrent refreshes
let isRefreshing = false

/**
 * Fetch drop domains exclusively from the DropCatch.com API.
 * No RDAP scanning — all data comes from DropCatch auctions and CSV downloads.
 *
 * @returns number of domains imported
 */
export async function fetchDropDomains(options?: {
  tlds?: string[]
  maxPerTld?: number
}): Promise<number> {
  if (!isDropCatchConfigured()) return 0

  // Prevent concurrent refreshes
  if (isRefreshing) {
    console.log('[dropcatch] Refresh already in progress, skipping')
    return 0
  }

  isRefreshing = true
  try {
    const tlds = options?.tlds || ['.com', '.net', '.org']
    const maxPerTld = options?.maxPerTld || 2000

    // Fetch from DropCatch API — all auction types (Dropped, PrivateSeller, PreRelease)
    const auctions = await fetchDropCatchAuctions({
      tlds: tlds.map(t => t.replace(/^\./, '')),
      maxPerTld,
    })

    // Also fetch from CSV downloads
    const dropping = await fetchDropCatchDropping()

    // Merge (auction data takes priority for duplicates since it has prices)
    const merged = new Map<string, any>()
    for (const d of dropping) {
      merged.set(d.domain_name, {
        domain_name: d.domain_name,
        tld: d.tld,
        drop_date: d.drop_date,
        status: d.auction_type === 'PreRelease' ? 'pre_release' : d.auction_type === 'PrivateSeller' ? 'private_seller' : 'dropped',
        source: 'dropcatch',
        registrar: '',
        auction_price: 0,
      })
    }
    for (const a of auctions) {
      merged.set(a.domain_name, {
        domain_name: a.domain_name,
        tld: a.tld,
        drop_date: a.end_time,
        status: a.auction_type === 'PreRelease' ? 'pre_release' : a.auction_type === 'PrivateSeller' ? 'private_seller' : 'dropped',
        source: 'dropcatch',
        registrar: a.bidders > 0 ? `${a.bidders} bidders` : '',
        auction_price: a.auction_price,
        auction_id: a.auction_id,
      })
    }

    console.log(`[dropcatch] DropCatch API: ${auctions.length} auctions, ${dropping.length} dropping, ${merged.size} merged`)

    if (merged.size > 0) {
      return importDropDomains(Array.from(merged.values()))
    }

    return 0
  } finally {
    isRefreshing = false
  }
}

// ============================================================================
// Import Drop Domains
// ============================================================================

/**
 * Import drop domains into the database (upsert).
 * Only imports pure-letter domains with length 1-5.
 */
export function importDropDomains(domains: any[]): number {
  const db = useDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO drop_domains (domain_name, tld, drop_date, status, source, registrar, estimated_value, auction_price, domain_length, has_numbers, has_hyphens, is_pure_letters, is_pure_numbers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let count = 0
  const insert = db.transaction((items: any[]) => {
    for (const d of items) {
      const analysis = analyzeDomain(d.domain_name)

      // Skip non-pure-letter domains
      if (!analysis.isPureLetters) continue
      // Skip domains longer than 5 characters
      if (analysis.length > 5) continue

      const estValue = d.estimated_value || 0
      const auctionPrice = d.auction_price || 0

      stmt.run(
        d.domain_name, d.tld || analysis.tld, d.drop_date || '',
        d.status || 'dropped', d.source || 'dropcatch',
        d.registrar || '',
        estValue, auctionPrice, analysis.length,
        analysis.hasNumbers ? 1 : 0, analysis.hasHyphens ? 1 : 0,
        analysis.isPureLetters ? 1 : 0, analysis.isPureNumbers ? 1 : 0
      )
      count++
    }
  })
  insert(domains)
  return count
}

// ============================================================================
// Registration price lookup via nazhumi.com API (for non-dropcatch domains)
// ============================================================================

// Cache TLD registration prices (refreshed hourly)
const regPriceCache = new Map<string, { price: number; currency: string; registrar: string; cachedAt: number }>()
const REG_PRICE_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Get the real cheapest registration price for a TLD from nazhumi.com API.
 */
async function getRegistrationPrice(tld: string): Promise<{ price: number; currency: string; registrar: string }> {
  const cleanTld = tld.replace(/^\./, '')
  const cached = regPriceCache.get(cleanTld)
  if (cached && Date.now() - cached.cachedAt < REG_PRICE_CACHE_TTL) {
    return { price: cached.price, currency: cached.currency, registrar: cached.registrar }
  }

  try {
    const res = await fetch(`https://www.nazhumi.com/api/v1?domain=${cleanTld}&order=new`, {
      headers: { 'User-Agent': 'DomainManager/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error('API error')

    const data = await res.json() as any
    if (data.code === 100 && data.data?.price?.length) {
      const cheapest = data.data.price[0]
      const result = {
        price: cheapest.new || 0,
        currency: (cheapest.currency || 'usd').toLowerCase(),
        registrar: cheapest.registrarname || '',
      }
      regPriceCache.set(cleanTld, { ...result, cachedAt: Date.now() })
      return result
    }
  } catch { /* ignore */ }

  // Fallback prices if API fails
  const fallbacks: Record<string, number> = { com: 9, net: 10, org: 9 }
  return { price: fallbacks[cleanTld] || 12, currency: 'usd', registrar: '' }
}

/**
 * Batch-fetch registration prices for multiple TLDs and update drop_domains.
 * Only updates non-dropcatch domains (dropcatch domains have real auction prices).
 */
export async function updateAuctionPrices(): Promise<number> {
  const db = useDatabase()
  const tlds = db.prepare("SELECT DISTINCT tld FROM drop_domains WHERE source != 'dropcatch'").all() as { tld: string }[]

  let updated = 0
  for (const { tld } of tlds) {
    const regPrice = await getRegistrationPrice(tld)
    const priceUsd = Math.round(regPrice.price * 100) / 100

    let catchPrice: number
    const cleanTld = tld.replace(/^\./, '')
    if (cleanTld === 'com') {
      catchPrice = priceUsd + 10
    } else if (cleanTld === 'net' || cleanTld === 'org') {
      catchPrice = priceUsd + 5
    } else {
      catchPrice = priceUsd + 3
    }

    const result = db.prepare(
      "UPDATE drop_domains SET auction_price = ? WHERE tld = ? AND source != 'dropcatch'"
    ).run(Math.round(catchPrice * 100) / 100, tld)
    updated += result.changes
  }

  return updated
}
