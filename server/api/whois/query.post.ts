import { defineEventHandler, readBody, createError, setResponseHeader } from 'h3'
import { useDatabase } from '~/server/database'
import { lookupDomain } from '~/server/utils/whois'
import { checkWhoisRateLimit } from '~/server/utils/ratelimit'
import { getClientIp } from '~/server/utils/clientip'

export default defineEventHandler(async (event) => {
  // Rate limiting
  const clientIp = getClientIp(event)
  const rateCheck = checkWhoisRateLimit(clientIp)
  if (!rateCheck.allowed) {
    setResponseHeader(event, 'Retry-After', String(rateCheck.retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: rateCheck.reason || '请求过于频繁，请稍后再试',
    })
  }

  const body = await readBody(event)
  const domainName = body?.domain?.trim()?.toLowerCase()

  if (!domainName) {
    throw createError({ statusCode: 400, statusMessage: 'domain is required' })
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
  if (!domainRegex.test(domainName)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid domain format' })
  }

  // Check cache: if we queried this domain in the last 5 minutes, return cached result
  const db = useDatabase()
  const cached = db.prepare(`
    SELECT query_result, raw_data FROM whois_query_logs
    WHERE domain_name = ? AND status = 'success'
    AND queried_at > datetime('now', '-5 minutes')
    ORDER BY queried_at DESC LIMIT 1
  `).get(domainName) as { query_result: string; raw_data: string } | undefined

  if (cached?.query_result) {
    try {
      const parsed = JSON.parse(cached.query_result)
      return {
        ...parsed,
        domain: domainName,
        rawText: cached.raw_data || '',
        queriedAt: new Date().toISOString(),
        cached: true,
      }
    } catch { /* parse failed, do fresh query */ }
  }

  try {
    const result = await lookupDomain(domainName)

    db.prepare(`
      INSERT INTO whois_query_logs (domain_name, query_result, raw_data, status, queried_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      domainName,
      JSON.stringify({
        registered: result.registered,
        registrar: result.registrar,
        registrationDate: result.registrationDate,
        expiryDate: result.expiryDate,
        updatedDate: result.updatedDate,
        nameservers: result.nameservers,
        status: result.status,
        dnssec: result.dnssec,
        registrantOrg: result.registrantOrg,
        registrantCountry: result.registrantCountry,
        whoisServer: result.whoisServer,
        source: result.source,
      }),
      result.rawText || '',
      result.error ? 'failed' : 'success'
    )

    return result
  } catch (err: any) {
    db.prepare(`
      INSERT INTO whois_query_logs (domain_name, query_result, raw_data, status, error_message, queried_at)
      VALUES (?, '', '', 'failed', ?, datetime('now'))
    `).run(domainName, err.message || 'Unknown error')

    throw createError({
      statusCode: 500,
      statusMessage: `WHOIS query failed: ${err.message}`,
    })
  }
})
