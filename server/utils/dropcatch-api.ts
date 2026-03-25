// DropCatch.com API Client
// Credentials from environment variables - NOT committed to git

import { inflateRawSync } from 'zlib'

const API_BASE = 'https://api.dropcatch.com'

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string | null> {
  const clientId = process.env.DROPCATCH_CLIENT_ID
  const clientSecret = process.env.DROPCATCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (cachedToken && Date.now() < tokenExpiry - 120000) return cachedToken

  try {
    const res = await fetch(`${API_BASE}/Authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ClientId: clientId, ClientSecret: clientSecret }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json() as any
    cachedToken = data.token
    tokenExpiry = Date.now() + 25 * 60 * 1000
    return cachedToken
  } catch {
    return null
  }
}

export function isDropCatchConfigured(): boolean {
  return !!(process.env.DROPCATCH_CLIENT_ID && process.env.DROPCATCH_CLIENT_SECRET)
}

export async function testDropCatchAuth(): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken()
  if (!token) return { ok: false, error: 'Authentication failed' }
  return { ok: true }
}

export interface DropCatchAuction {
  domain_name: string
  tld: string
  auction_price: number
  end_time: string
  bidders: number
  auction_type: string
  auction_id: number
}

// ============================================================================
// ZIP extraction helper
// ============================================================================

/**
 * Extract the first file from a ZIP buffer using raw inflate.
 * ZIP local file header: PK\x03\x04, then metadata, then compressed data.
 */
function extractZipFirstFile(zipBuffer: Buffer): string {
  // Find PK\x03\x04 signature
  const sig = Buffer.from([0x50, 0x4B, 0x03, 0x04])
  const idx = zipBuffer.indexOf(sig)
  if (idx === -1) {
    // Not a ZIP — try as plain text
    return zipBuffer.toString('utf8')
  }

  // Parse local file header
  const compressionMethod = zipBuffer.readUInt16LE(idx + 8)
  const compressedSize = zipBuffer.readUInt32LE(idx + 18)
  const fileNameLength = zipBuffer.readUInt16LE(idx + 26)
  const extraFieldLength = zipBuffer.readUInt16LE(idx + 28)
  const dataOffset = idx + 30 + fileNameLength + extraFieldLength

  if (compressionMethod === 0) {
    // Stored (no compression)
    return zipBuffer.subarray(dataOffset, dataOffset + compressedSize).toString('utf8')
  } else if (compressionMethod === 8) {
    // Deflate
    const compressed = zipBuffer.subarray(dataOffset, dataOffset + compressedSize)
    const decompressed = inflateRawSync(compressed)
    return decompressed.toString('utf8')
  }

  // Fallback: try raw text
  return zipBuffer.toString('utf8')
}

// ============================================================================
// Main data fetching — uses CSV downloads (full data, not limited to 100)
// ============================================================================

/**
 * Download ALL auction domains from DropCatch via AllAuctions CSV.
 * This returns the COMPLETE dataset (27,000+ domains), unlike the
 * /v2/auctions API which is capped at 100 per type.
 *
 * Returns only pure-letter 1-5 char domains.
 */
export async function fetchAllAuctionsCsv(options?: {
  tlds?: string[]
}): Promise<DropCatchAuction[]> {
  const token = await getToken()
  if (!token) return []

  const allowedTlds = new Set((options?.tlds || ['com', 'net', 'org']).map(t => t.replace(/^\./, '').toLowerCase()))

  try {
    console.log('[dropcatch-api] Downloading AllAuctions CSV...')
    const res = await fetch(`${API_BASE}/v2/downloads/auctions/AllAuctions?fileType=Csv`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60000), // 60s for large file
    })

    if (!res.ok) {
      console.warn(`[dropcatch-api] AllAuctions download: HTTP ${res.status}`)
      return []
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const csvText = extractZipFirstFile(buffer)

    // Parse CSV: Domain,TLD,Type,Auction End
    const lines = csvText.split(/\r?\n/)
    const results: DropCatchAuction[] = []
    const seen = new Set<string>()

    let skippedHeader = false
    for (const line of lines) {
      if (!skippedHeader) {
        if (line.includes('Domain,TLD') || line.startsWith('*')) {
          skippedHeader = true
          continue
        }
        if (line.includes(',')) skippedHeader = true
        else continue
      }

      const parts = line.split(',')
      if (parts.length < 4) continue

      const rawDomain = parts[0].trim()
      const tld = parts[1].trim().toLowerCase()
      const auctionType = parts[2].trim()
      const endDate = parts[3].trim()

      if (!tld || !allowedTlds.has(tld)) continue

      // Get SLD (the domain name part before TLD)
      const sld = rawDomain.toLowerCase().replace(/\..+$/, '')

      // Filter: pure letters, 1-5 chars
      if (!/^[a-z]+$/.test(sld)) continue
      if (sld.length > 5) continue

      const fullDomain = `${sld}.${tld}`
      if (seen.has(fullDomain)) continue
      seen.add(fullDomain)

      // DropCatch auctions end at 3:00 PM ET (Eastern Time) daily = 19:00 UTC
      const endTimeUtc = endDate.includes('T') ? endDate : `${endDate}T19:00:00Z`

      results.push({
        domain_name: fullDomain,
        tld: '.' + tld,
        auction_price: 0,
        end_time: endTimeUtc,
        bidders: 0,
        auction_type: auctionType,
        auction_id: 0,
      })
    }

    console.log(`[dropcatch-api] AllAuctions CSV: ${lines.length} lines, ${results.length} matched`)
    return results
  } catch (err) {
    console.warn('[dropcatch-api] AllAuctions download failed:', (err as Error).message)
    return []
  }
}

/**
 * Fetch auction prices via /v2/auctions API with smart filter combinations.
 * Each API call returns max 100 results, so we make multiple calls with
 * different filter combos (type × tld × time window) for maximum coverage.
 *
 * This gives us real-time prices and bidder counts for ~1000+ domains.
 */
export async function fetchAuctionPrices(options?: {
  tlds?: string[]
}): Promise<Map<string, { price: number; bidders: number; endTime: string }>> {
  const token = await getToken()
  if (!token) return new Map()

  const tlds = (options?.tlds || ['com', 'net', 'org']).map(t => t.replace(/^\./, ''))
  const priceMap = new Map<string, { price: number; bidders: number; endTime: string }>()
  const types = ['Dropped', 'PrivateSeller', 'PreRelease']

  // Strategy: query each type × tld × time window for max coverage
  // Each combo returns up to 100, so 3 types × 3 tlds × 4 windows = 36 API calls ≈ 3600 results
  const now = new Date()
  const timeWindows = [
    { min: '', max: new Date(now.getTime() + 1 * 86400000).toISOString() },  // next 1 day
    { min: new Date(now.getTime() + 1 * 86400000).toISOString(), max: new Date(now.getTime() + 3 * 86400000).toISOString() },
    { min: new Date(now.getTime() + 3 * 86400000).toISOString(), max: new Date(now.getTime() + 7 * 86400000).toISOString() },
    { min: new Date(now.getTime() + 7 * 86400000).toISOString(), max: '' },  // 7+ days
  ]

  let apiCalls = 0
  for (const auctionType of types) {
    for (const tld of tlds) {
      for (const window of timeWindows) {
        try {
          const params = new URLSearchParams({
            size: '100',
            showAllActive: 'true',
          })
          params.append('Types', auctionType)
          params.append('Tlds', tld)
          if (window.max) params.set('EndTime.Max', window.max)
          if (window.min) params.set('EndTime.Min', window.min)

          const res = await fetch(`${API_BASE}/v2/auctions?${params}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          })
          apiCalls++
          if (!res.ok) continue

          const data = await res.json() as any
          for (const item of (data.items || [])) {
            const name = (item.name || '').toLowerCase()
            const existing = priceMap.get(name)
            // Keep the entry with the highest bid (most up-to-date)
            if (!existing || (item.highBid || 0) > existing.price) {
              priceMap.set(name, {
                price: item.highBid || 0,
                bidders: item.numberOfBidders || 0,
                endTime: item.endTime || '',
              })
            }
          }

          await new Promise(r => setTimeout(r, 50)) // brief delay
        } catch {}
      }
    }
  }

  console.log(`[dropcatch-api] Price enrichment: ${apiCalls} API calls, ${priceMap.size} domains with prices`)
  return priceMap
}
