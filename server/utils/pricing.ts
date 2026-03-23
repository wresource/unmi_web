// ============================================================================
// Domain Pricing Service - Powered by nazhumi.com API
// ============================================================================

const API_BASE = 'https://www.nazhumi.com/api/v1'

// Cache: TLD -> pricing data (cached for 1 hour)
const priceCache = new Map<string, { data: PricingResult; cachedAt: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Registrar code list cache
let registrarList: RegistrarInfo[] | null = null
let registrarListCachedAt = 0

export interface PriceEntry {
  registrar: string
  registrarName: string
  registrarWeb: string
  newPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
  currency: string
  currencyName: string
  hasPromoNew: boolean
  hasPromoRenew: boolean
  hasPromoTransfer: boolean
  updatedTime: string
}

export interface PricingResult {
  tld: string
  prices: PriceEntry[]
  cheapestNew: PriceEntry | null
  cheapestRenew: PriceEntry | null
  cheapestTransfer: PriceEntry | null
  queriedAt: string
}

export interface RegistrarInfo {
  name: string
  code: string
  url: string
  active: boolean
}

/**
 * Extract TLD from a domain name (e.g., "example.com" -> "com", "test.co.uk" -> "co.uk")
 */
function extractTld(domain: string): string {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return ''

  // Handle common multi-level TLDs
  const multiLevelTlds = [
    'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ac.uk',
    'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
    'com.au', 'net.au', 'org.au', 'edu.au',
    'co.nz', 'net.nz', 'org.nz',
    'com.br', 'net.br', 'org.br',
    'co.kr', 'or.kr', 'ne.kr',
    'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
    'com.sg', 'net.sg', 'org.sg', 'edu.sg',
    'com.my', 'net.my', 'org.my',
    'co.th', 'in.th', 'ac.th',
    'com.tw', 'net.tw', 'org.tw', 'idv.tw',
    'com.hk', 'net.hk', 'org.hk', 'idv.hk',
    'co.za', 'net.za', 'org.za', 'web.za',
    'com.mx', 'net.mx', 'org.mx',
    'com.ar', 'net.ar', 'org.ar',
    'com.tr', 'net.tr', 'org.tr',
    'com.ru', 'net.ru', 'org.ru',
    'co.il', 'org.il', 'net.il',
  ]

  if (parts.length >= 3) {
    const twoLevel = parts.slice(-2).join('.')
    if (multiLevelTlds.includes(twoLevel)) {
      return twoLevel
    }
  }

  return parts[parts.length - 1]
}

/**
 * Parse a price value from the API response
 */
function parsePrice(val: any): number | null {
  if (val === 'n/a' || val === null || val === undefined || val === '') return null
  const num = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(num) ? null : num
}

/**
 * Normalize API response to our format
 */
function normalizePriceEntry(entry: any): PriceEntry {
  return {
    registrar: entry.registrar || '',
    registrarName: entry.registrarname || entry.registrar || '',
    registrarWeb: entry.registrarweb || '',
    newPrice: parsePrice(entry.new),
    renewPrice: parsePrice(entry.renew),
    transferPrice: parsePrice(entry.transfer),
    currency: (entry.currency || 'usd').toLowerCase(),
    currencyName: entry.currencyname || entry.currencytype || '',
    hasPromoNew: entry.promocode?.new === true,
    hasPromoRenew: entry.promocode?.renew === true,
    hasPromoTransfer: entry.promocode?.transfer === true,
    updatedTime: entry.updatedtime || '',
  }
}

/**
 * Query pricing info for a TLD from nazhumi.com
 * Returns pricing from multiple registrars sorted by different criteria
 */
export async function queryTldPricing(tld: string): Promise<PricingResult> {
  const cleanTld = tld.replace(/^\./, '').toLowerCase()

  // Check cache
  const cached = priceCache.get(cleanTld)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.data
  }

  // Fetch prices sorted by new, renew, and transfer in parallel
  const [byNew, byRenew, byTransfer] = await Promise.all([
    fetchPrices(cleanTld, 'new'),
    fetchPrices(cleanTld, 'renew'),
    fetchPrices(cleanTld, 'transfer'),
  ])

  // Merge and deduplicate all prices
  const priceMap = new Map<string, PriceEntry>()
  for (const entry of [...byNew, ...byRenew, ...byTransfer]) {
    const existing = priceMap.get(entry.registrar)
    if (!existing) {
      priceMap.set(entry.registrar, entry)
    } else {
      // Merge: keep the most complete data
      if (entry.newPrice !== null && existing.newPrice === null) existing.newPrice = entry.newPrice
      if (entry.renewPrice !== null && existing.renewPrice === null) existing.renewPrice = entry.renewPrice
      if (entry.transferPrice !== null && existing.transferPrice === null) existing.transferPrice = entry.transferPrice
    }
  }

  const allPrices = Array.from(priceMap.values())

  // Find cheapest for each category
  const cheapestNew = findCheapest(allPrices, 'newPrice')
  const cheapestRenew = findCheapest(allPrices, 'renewPrice')
  const cheapestTransfer = findCheapest(allPrices, 'transferPrice')

  const result: PricingResult = {
    tld: cleanTld,
    prices: allPrices,
    cheapestNew,
    cheapestRenew,
    cheapestTransfer,
    queriedAt: new Date().toISOString(),
  }

  // Cache result
  priceCache.set(cleanTld, { data: result, cachedAt: Date.now() })

  return result
}

/**
 * Fetch prices from the API for a given TLD and sort order
 */
async function fetchPrices(tld: string, order: string): Promise<PriceEntry[]> {
  try {
    const url = `${API_BASE}?domain=${encodeURIComponent(tld)}&order=${order}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DomainManager/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return []

    const json = await response.json() as any
    if (json.code !== 100 || !json.data?.price) return []

    return json.data.price.map(normalizePriceEntry)
  } catch {
    return []
  }
}

/**
 * Find the cheapest entry for a given price field
 */
function findCheapest(
  prices: PriceEntry[],
  field: 'newPrice' | 'renewPrice' | 'transferPrice'
): PriceEntry | null {
  let cheapest: PriceEntry | null = null
  let lowestPrice = Infinity

  for (const entry of prices) {
    const price = entry[field]
    if (price !== null && price < lowestPrice) {
      lowestPrice = price
      cheapest = entry
    }
  }

  return cheapest
}

/**
 * Query pricing for a specific registrar + TLD combination
 */
export async function queryRegistrarPricing(
  registrar: string,
  tld: string
): Promise<PriceEntry | null> {
  const cleanTld = tld.replace(/^\./, '').toLowerCase()

  try {
    const url = `${API_BASE}?registrar=${encodeURIComponent(registrar)}&domain=${encodeURIComponent(cleanTld)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DomainManager/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const json = await response.json() as any
    if (json.code !== 100 || !json.data?.price?.length) return null

    return normalizePriceEntry(json.data.price[0])
  } catch {
    return null
  }
}

/**
 * Get the list of supported registrars from nazhumi.com
 */
export async function getRegistrarList(): Promise<RegistrarInfo[]> {
  if (registrarList && Date.now() - registrarListCachedAt < CACHE_TTL) {
    return registrarList
  }

  try {
    const response = await fetch('https://www.nazhumi.com/api/aboutapi', {
      headers: { 'User-Agent': 'DomainManager/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return []

    const json = await response.json() as any
    if (!json.data?.registrar) return []

    registrarList = json.data.registrar.map((r: any[]) => ({
      name: r[0] || '',
      code: r[1] || '',
      url: r[2] || '',
      active: r.length < 4 || r[3] !== 'inactive',
    }))
    registrarListCachedAt = Date.now()

    return registrarList!
  } catch {
    return []
  }
}

/**
 * Combined lookup: get WHOIS + pricing info for a domain
 * Returns pricing data ready for the domain form
 */
export async function lookupDomainPricing(domain: string): Promise<{
  tld: string
  pricing: PricingResult
  suggestedRenewPrice: number | null
  suggestedPurchasePrice: number | null
  suggestedCurrency: string
}> {
  const tld = extractTld(domain)
  if (!tld) {
    return {
      tld: '',
      pricing: { tld: '', prices: [], cheapestNew: null, cheapestRenew: null, cheapestTransfer: null, queriedAt: new Date().toISOString() },
      suggestedRenewPrice: null,
      suggestedPurchasePrice: null,
      suggestedCurrency: 'CNY',
    }
  }

  const pricing = await queryTldPricing(tld)

  // Suggest the cheapest renewal price (prefer CNY if available)
  let suggestedRenewPrice: number | null = null
  let suggestedPurchasePrice: number | null = null
  let suggestedCurrency = 'CNY'

  // First try to find CNY prices
  const cnyPrices = pricing.prices.filter(p => p.currency === 'cny')
  if (cnyPrices.length > 0) {
    const cheapestCnyRenew = findCheapest(cnyPrices, 'renewPrice')
    const cheapestCnyNew = findCheapest(cnyPrices, 'newPrice')
    if (cheapestCnyRenew) suggestedRenewPrice = cheapestCnyRenew.renewPrice
    if (cheapestCnyNew) suggestedPurchasePrice = cheapestCnyNew.newPrice
    suggestedCurrency = 'CNY'
  } else if (pricing.cheapestRenew) {
    suggestedRenewPrice = pricing.cheapestRenew.renewPrice
    suggestedPurchasePrice = pricing.cheapestNew?.newPrice ?? null
    suggestedCurrency = pricing.cheapestRenew.currency === 'usd' ? 'USD' : pricing.cheapestRenew.currency.toUpperCase()
  }

  return {
    tld,
    pricing,
    suggestedRenewPrice,
    suggestedPurchasePrice,
    suggestedCurrency,
  }
}
