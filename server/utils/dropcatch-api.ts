// DropCatch.com API Client
// Credentials from environment variables - NOT committed to git

const API_BASE = 'https://api.dropcatch.com'

// Token cache
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
  if (!token) return { ok: false, error: 'Authentication failed - check credentials' }
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

/**
 * Fetch ALL active auctions from DropCatch — Dropped + PrivateSeller + PreRelease.
 * Sorted by ending soonest first. Max 2000 per TLD.
 * Only pure letter domains, length 1-5.
 */
export async function fetchDropCatchAuctions(options?: {
  tlds?: string[]
  maxPerTld?: number
}): Promise<DropCatchAuction[]> {
  const token = await getToken()
  if (!token) return []

  const tlds = options?.tlds || ['com', 'net', 'org']
  const maxPerTld = options?.maxPerTld || 2000
  const allResults: DropCatchAuction[] = []
  const seen = new Set<string>()

  // Strategy: fetch ALL types together, paginate through time windows
  // Use EndTime.Max to get auctions ending within 7 days (most relevant)
  const now = new Date()
  const timeWindows = [
    new Date(now.getTime() + 1 * 86400000),   // next 1 day
    new Date(now.getTime() + 3 * 86400000),   // next 3 days
    new Date(now.getTime() + 7 * 86400000),   // next 7 days
    new Date(now.getTime() + 30 * 86400000),  // next 30 days
  ]

  for (const windowEnd of timeWindows) {
    // Fetch all types in this time window
    for (const auctionType of ['Dropped', 'PrivateSeller', 'PreRelease']) {
      try {
        let nextCursor: string | undefined
        let pagesFetched = 0

        while (pagesFetched < 20) {
          const params = new URLSearchParams({
            size: '100',
            showAllActive: 'true',
          })
          params.append('Types', auctionType)
          params.set('EndTime.Max', windowEnd.toISOString())
          for (const tld of tlds) params.append('Tlds', tld)
          if (nextCursor) params.set('next', nextCursor)

          const res = await fetch(`${API_BASE}/v2/auctions?${params}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
          })

          if (!res.ok) break

          const data = await res.json() as any
          const items = data.items || []
          if (items.length === 0) break

          for (const item of items) {
            const name = (item.name || '').toLowerCase()
            if (!name.includes('.') || seen.has(name)) continue
            const sld = name.split('.')[0]
            const tld = '.' + name.split('.').slice(1).join('.')

            if (!/^[a-z]+$/.test(sld) || sld.length > 5) continue

            seen.add(name)
            allResults.push({
              domain_name: name,
              tld,
              auction_price: item.highBid || 0,
              end_time: item.endTime || '',
              bidders: item.numberOfBidders || 0,
              auction_type: item.type || auctionType,
              auction_id: item.auctionId || 0,
            })
          }

          nextCursor = data.next
          if (!nextCursor) break
          pagesFetched++
          await new Promise(r => setTimeout(r, 100))
        }
      } catch (err) {
        console.warn(`[dropcatch-api] ${auctionType} window failed:`, (err as Error).message)
      }
    }
  }

  console.log(`[dropcatch-api] Total fetched: ${allResults.length} domains`)

  // Sort by end_time ascending
  allResults.sort((a, b) => {
    if (!a.end_time) return 1
    if (!b.end_time) return -1
    return new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
  })

  return allResults
}

/**
 * Download ALL auction domain CSVs from DropCatch (Dropped + PrivateSeller + PreRelease).
 * Returns parsed domain list filtered for pure letter 1-5 char domains.
 */
export async function fetchDropCatchDropping(): Promise<{
  domain_name: string
  tld: string
  drop_date: string
  auction_type: string
}[]> {
  const token = await getToken()
  if (!token) return []

  const allResults: any[] = []
  const downloadTypes = ['DroppedAuctions', 'PrivateSeller', 'PreRelease']

  for (const dlType of downloadTypes) {
    try {
      const res = await fetch(`${API_BASE}/v2/downloads/auctions/${dlType}?fileType=Csv`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        console.warn(`[dropcatch-api] Download ${dlType}: HTTP ${res.status}`)
        continue
      }

      const buffer = await res.arrayBuffer()
      const decoder = new TextDecoder()
      const text = decoder.decode(new Uint8Array(buffer))

      // Find CSV content in the ZIP (look for the CSV header line)
      const csvMatch = text.match(/Domain,TLD,Type,Auction End\r?\n([\s\S]*?)(?:PK\x01|\x00{10,}|$)/)
      if (!csvMatch) continue

      const lines = csvMatch[1].trim().split(/\r?\n/)
      for (const line of lines) {
        const parts = line.split(',')
        if (parts.length < 4) continue
        const domainName = parts[0].trim().toLowerCase()
        const tld = parts[1].trim().toLowerCase()
        const auctionType = parts[2].trim()
        const endDate = parts[3].trim()

        if (!tld) continue
        const sld = domainName.replace(/\..+$/, '') // handle if domain already has TLD

        // Filter: pure letters, 1-5 chars
        if (!/^[a-z]+$/.test(sld)) continue
        if (sld.length > 5) continue

        const fullDomain = domainName.includes('.') ? domainName : `${domainName}.${tld}`

        // Avoid duplicates
        if (!allResults.some(r => r.domain_name === fullDomain)) {
          allResults.push({
            domain_name: fullDomain,
            tld: '.' + tld,
            drop_date: endDate,
            auction_type: auctionType,
          })
        }
      }

      console.log(`[dropcatch-api] Download ${dlType}: parsed, total ${allResults.length}`)
    } catch (err) {
      console.warn(`[dropcatch-api] Download ${dlType} failed:`, (err as Error).message)
    }
  }

  return allResults
}
