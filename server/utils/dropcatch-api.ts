// DropCatch.com API Client
// Credentials from environment variables - NOT committed to git

const API_BASE = 'https://api.dropcatch.com'

// Token cache
let cachedToken: string | null = null
let tokenExpiry = 0

/**
 * Get or refresh the DropCatch API token.
 * Reads credentials from environment variables.
 */
async function getToken(): Promise<string | null> {
  // Check if configured
  const clientId = process.env.DROPCATCH_CLIENT_ID
  const clientSecret = process.env.DROPCATCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Return cached token if still valid (with 2 min buffer)
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
    tokenExpiry = Date.now() + 25 * 60 * 1000 // 25 min (tokens last 30 min)
    return cachedToken
  } catch {
    return null
  }
}

/**
 * Check if DropCatch API is configured (env vars set).
 */
export function isDropCatchConfigured(): boolean {
  return !!(process.env.DROPCATCH_CLIENT_ID && process.env.DROPCATCH_CLIENT_SECRET)
}

/**
 * Try to authenticate with DropCatch API.
 * Returns true if authentication succeeds.
 */
export async function testDropCatchAuth(): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken()
  if (!token) {
    return { ok: false, error: 'Authentication failed - check credentials' }
  }
  return { ok: true }
}

/**
 * Fetch active auctions from DropCatch.
 * Filters for pure-letter domains, length 1-5, specified TLDs.
 */
export async function fetchDropCatchAuctions(options?: {
  tlds?: string[]
  maxResults?: number
}): Promise<{
  domain_name: string
  tld: string
  auction_price: number
  end_time: string
  bidders: number
  auction_type: string
  auction_id: number
}[]> {
  const token = await getToken()
  if (!token) return []

  const tlds = options?.tlds || ['com', 'net', 'org']
  const maxResults = options?.maxResults || 100
  const results: any[] = []

  try {
    // Fetch from API - paginate through results
    let nextCursor: string | undefined
    let fetched = 0

    while (fetched < maxResults * 3) { // Fetch more than needed since we filter
      const params = new URLSearchParams({
        size: '100',
        showAllActive: 'true',
      })
      for (const tld of tlds) params.append('Tlds', tld)
      if (nextCursor) params.set('next', nextCursor)

      const res = await fetch(`${API_BASE}/v2/auctions?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) break

      const data = await res.json() as any
      const items = data.items || []
      if (items.length === 0) break

      for (const item of items) {
        const name = (item.name || '').toLowerCase()
        if (!name.includes('.')) continue
        const sld = name.split('.')[0]
        const tld = name.split('.').slice(1).join('.')

        // Filter: pure letters, 1-5 chars
        if (!/^[a-z]+$/.test(sld)) continue
        if (sld.length > 5) continue

        results.push({
          domain_name: name,
          tld: '.' + tld,
          auction_price: item.highBid || 0,
          end_time: item.endTime || '',
          bidders: item.numberOfBidders || 0,
          auction_type: item.type || 'Dropped',
          auction_id: item.auctionId || 0,
        })

        if (results.length >= maxResults) break
      }

      if (results.length >= maxResults) break

      nextCursor = data.next
      if (!nextCursor) break
      fetched += items.length

      // Brief delay between pages
      await new Promise(r => setTimeout(r, 200))
    }
  } catch (err) {
    console.warn('[dropcatch-api] Fetch auctions failed:', (err as Error).message)
  }

  return results
}

/**
 * Download dropping domain CSV from DropCatch.
 * Returns parsed domain list.
 */
export async function fetchDropCatchDropping(): Promise<{
  domain_name: string
  tld: string
  drop_date: string
  auction_type: string
}[]> {
  const token = await getToken()
  if (!token) return []

  try {
    const res = await fetch(`${API_BASE}/v2/downloads/auctions/DroppedAuctions?fileType=Csv`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []

    // Response is a ZIP file - we need to extract and parse CSV
    const buffer = await res.arrayBuffer()
    const results: any[] = []

    // Simple ZIP extraction - find CSV content after local file header
    const bytes = new Uint8Array(buffer)
    // Look for CSV content (skip ZIP headers, find the CSV data)
    const decoder = new TextDecoder()
    const text = decoder.decode(bytes)

    // Find the CSV section - it starts after the ZIP local file header
    // The CSV has format: Domain,TLD,Type,Auction End
    const csvMatch = text.match(/Domain,TLD,Type,Auction End\r?\n([\s\S]*?)(?:PK|\x00{10,}|$)/)
    if (!csvMatch) {
      // Try to decompress - we need a different approach for ZIP
      // For now, use the downloads/dropping endpoint instead which might return plain CSV
      return []
    }

    const lines = csvMatch[1].trim().split(/\r?\n/)
    for (const line of lines) {
      const parts = line.split(',')
      if (parts.length < 4) continue
      const domainName = parts[0].trim().toLowerCase()
      const tld = parts[1].trim().toLowerCase()
      const auctionType = parts[2].trim()
      const endDate = parts[3].trim()

      if (!domainName.includes('.') && tld) {
        // Domain and TLD are separate columns
        const fullDomain = `${domainName}.${tld}`
        const sld = domainName

        // Filter: pure letters, 1-5 chars
        if (!/^[a-z]+$/.test(sld)) continue
        if (sld.length > 5) continue

        results.push({
          domain_name: fullDomain,
          tld: '.' + tld,
          drop_date: endDate,
          auction_type: auctionType,
        })
      }
    }

    return results
  } catch (err) {
    console.warn('[dropcatch-api] Fetch dropping failed:', (err as Error).message)
    return []
  }
}
