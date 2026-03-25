import { useDatabase } from '~/server/database'

// ============================================================================
// RDAP Bootstrap (mirrors whois.ts logic but exported for dropcatch use)
// ============================================================================

let rdapBootstrapCache: Map<string, string> | null = null
let rdapBootstrapCacheTime = 0
const RDAP_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const RDAP_REQUEST_TIMEOUT = 5_000 // 5s for dropcatch (shorter than whois)

async function loadRdapBootstrap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (rdapBootstrapCache && (now - rdapBootstrapCacheTime) < RDAP_CACHE_TTL) {
    return rdapBootstrapCache
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RDAP_REQUEST_TIMEOUT)

    const response = await fetch('https://data.iana.org/rdap/dns.json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`RDAP bootstrap fetch failed: HTTP ${response.status}`)
    }

    const data = await response.json() as { services: [string[], string[]][] }
    const map = new Map<string, string>()

    for (const [tlds, servers] of data.services) {
      const server = servers.find(s => s.startsWith('https://')) || servers[0]
      if (!server) continue
      const normalizedServer = server.endsWith('/') ? server : server + '/'
      for (const tld of tlds) {
        map.set(tld.toLowerCase(), normalizedServer)
      }
    }

    rdapBootstrapCache = map
    rdapBootstrapCacheTime = now
    return map
  } catch (err) {
    if (rdapBootstrapCache) return rdapBootstrapCache
    console.warn('[dropcatch] Failed to load RDAP bootstrap:', (err as Error).message)
    return new Map()
  }
}

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
// RDAP Domain Availability Check
// ============================================================================

interface RdapCheckResult {
  available: boolean
  status: 'available' | 'pending_delete' | 'expired' | 'expiring' | 'registered'
  expiryDate?: string
  registrar?: string
}

/**
 * Check a single domain's availability/status via RDAP.
 * Returns null if the request fails (network error, unsupported TLD, etc.)
 */
async function checkDomainViaRdap(domain: string): Promise<RdapCheckResult | null> {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return null

  const tld = parts.slice(1).join('.')
  const bootstrap = await loadRdapBootstrap()

  // Try exact TLD match, then top-level only
  let rdapServer = bootstrap.get(tld)
  if (!rdapServer && parts.length > 2) {
    rdapServer = bootstrap.get(parts[parts.length - 1])
  }
  if (!rdapServer) return null

  try {
    const url = `${rdapServer}domain/${domain}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RDAP_REQUEST_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json, application/json' },
    })
    clearTimeout(timer)

    // 404 = domain not found = available/dropped
    if (response.status === 404) {
      return { available: true, status: 'available' }
    }

    // Non-OK response = skip this domain
    if (!response.ok) return null

    const data = await response.json() as any

    // Extract status array
    const statusArr: string[] = Array.isArray(data.status) ? data.status : []
    const statusLower = statusArr.map((s: string) => s.toLowerCase())

    // Extract expiry date from events
    let expiryDate: string | undefined
    if (Array.isArray(data.events)) {
      for (const evt of data.events) {
        if (evt.eventAction === 'expiration' && evt.eventDate) {
          expiryDate = evt.eventDate
        }
      }
    }

    // Extract registrar
    let registrar = ''
    if (Array.isArray(data.entities)) {
      for (const entity of data.entities) {
        if (Array.isArray(entity.roles) && entity.roles.includes('registrar')) {
          if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
            for (const field of entity.vcardArray[1]) {
              if (field[0] === 'fn') {
                registrar = field[3] || ''
                break
              }
            }
          }
          if (!registrar && entity.handle) {
            registrar = entity.handle
          }
        }
      }
    }

    // Check for pending delete statuses
    const pendingDeleteStatuses = ['pendingdelete', 'pending delete', 'redemptionperiod', 'redemption period']
    const isPendingDelete = statusLower.some(s => pendingDeleteStatuses.some(pd => s.includes(pd)))
    if (isPendingDelete) {
      return {
        available: false,
        status: 'pending_delete',
        expiryDate,
        registrar,
      }
    }

    // Check if expired (expiry date in the past)
    if (expiryDate) {
      const expiry = new Date(expiryDate)
      if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        return {
          available: false,
          status: 'expired',
          expiryDate,
          registrar,
        }
      }
    }

    // Check if expiring soon (within 90 days) — valuable for monitoring
    if (expiryDate) {
      const expiry = new Date(expiryDate)
      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (86400000))
      if (daysLeft > 0 && daysLeft <= 90) {
        return {
          available: false,
          status: 'expiring' as any,
          expiryDate,
          registrar,
        }
      }
    }

    // Domain is registered and active (expiry > 90 days)
    return {
      available: false,
      status: 'registered',
      expiryDate,
      registrar,
    }
  } catch (err) {
    console.warn(`[dropcatch] RDAP check failed for ${domain}:`, (err as Error).message)
    return null
  }
}

// ============================================================================
// Candidate Domain Generation
// ============================================================================

/**
 * Generate candidate domain names to check.
 * Focus on short, valuable patterns that are most likely to be dropping.
 */
function generateCandidates(tlds: string[], maxPerTld: number): string[] {
  const candidates: string[] = []

  // 3-letter CVC patterns (pronounceable, most valuable)
  const vowels = 'aeiou'
  const consonants = 'bcdfghjklmnpqrstvwxyz'
  for (const c1 of consonants.slice(0, 10)) {
    for (const v of vowels) {
      for (const c2 of consonants.slice(0, 5)) {
        candidates.push(`${c1}${v}${c2}`)
      }
    }
  }

  // 3-digit numbers (100-200)
  for (let i = 100; i <= 200; i++) {
    candidates.push(String(i))
  }

  // 4-letter popular patterns
  const words4 = [
    'tech', 'data', 'code', 'fast', 'easy', 'cool', 'mega', 'meta', 'next',
    'blue', 'gold', 'star', 'fire', 'wave', 'rock', 'lake', 'zero', 'hero',
    'king', 'play',
  ]
  candidates.push(...words4)

  // Shuffle and limit per TLD
  const shuffled = candidates.sort(() => Math.random() - 0.5)
  const limited = shuffled.slice(0, maxPerTld)

  // Combine with TLDs
  const result: string[] = []
  for (const name of limited) {
    for (const tld of tlds) {
      result.push(`${name}.${tld.replace(/^\./, '')}`)
    }
  }
  return result
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch real dropping/expired/available domains via RDAP checks.
 *
 * - Generates candidate short domain patterns
 * - Checks each via RDAP with rate limiting (500ms between requests)
 * - Only returns domains that are available, pending_delete, or expired
 * - Imports found domains into the drop_domains table
 * - Max 20 RDAP calls per invocation to protect server IP
 *
 * @returns number of domains imported
 */
export async function fetchRealDropDomains(options?: {
  tlds?: string[]
  maxResults?: number
  domains?: string[]  // Manual domain list to check instead of generating
}): Promise<number> {
  const tlds = options?.tlds || ['.com', '.net', '.org', '.io']
  const maxResults = options?.maxResults || 100
  const maxChecks = 20 // Hard limit on RDAP calls per request

  // Determine which domains to check
  let domainsToCheck: string[]
  if (options?.domains && options.domains.length > 0) {
    // Manual mode: check specific domains provided by user
    domainsToCheck = options.domains
      .map(d => d.toLowerCase().trim())
      .filter(d => d.includes('.') && d.length > 2)
      .slice(0, maxChecks)
  } else {
    // Auto mode: generate candidates (5 names per TLD × N TLDs = up to 20 checks)
    const namesPerTld = Math.max(1, Math.floor(maxChecks / tlds.length))
    const candidates = generateCandidates(tlds, namesPerTld)
    domainsToCheck = candidates.slice(0, maxChecks)
  }

  // Check each domain via RDAP with rate limiting
  const found: {
    domain_name: string
    status: string
    expiryDate?: string
    registrar?: string
  }[] = []

  for (const domain of domainsToCheck) {
    try {
      const result = await checkDomainViaRdap(domain)
      if (result && result.status !== 'registered') {
        found.push({
          domain_name: domain,
          status: result.status,
          expiryDate: result.expiryDate,
          registrar: result.registrar,
        })
      }
    } catch (err) {
      console.warn(`[dropcatch] Error checking ${domain}:`, (err as Error).message)
    }

    // Rate limit: 500ms between RDAP requests
    await new Promise(r => setTimeout(r, 500))
  }

  // Import found domains into database
  if (found.length > 0) {
    const toImport = found.slice(0, maxResults).map(d => ({
      domain_name: d.domain_name,
      tld: '.' + d.domain_name.split('.').slice(1).join('.'),
      drop_date: d.expiryDate || '',
      status: d.status,
      source: 'rdap',
      registrar: d.registrar || '',
      estimated_value: 0, // Will be calculated by appraisal engine after import
    }))

    return importDropDomains(toImport)
  }

  return 0
}

// ============================================================================
// Import Drop Domains
// ============================================================================

/**
 * Import drop domains into the database (upsert)
 */
export function importDropDomains(domains: any[]): number {
  const db = useDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO drop_domains (domain_name, tld, drop_date, status, source, estimated_value, domain_length, has_numbers, has_hyphens, is_pure_letters, is_pure_numbers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let count = 0
  const insert = db.transaction((items: any[]) => {
    for (const d of items) {
      const analysis = analyzeDomain(d.domain_name)
      stmt.run(
        d.domain_name, d.tld || analysis.tld, d.drop_date || '',
        d.status || 'pending_delete', d.source || 'import',
        d.estimated_value || 0, analysis.length,
        analysis.hasNumbers ? 1 : 0, analysis.hasHyphens ? 1 : 0,
        analysis.isPureLetters ? 1 : 0, analysis.isPureNumbers ? 1 : 0
      )
      count++
    }
  })
  insert(domains)
  return count
}
