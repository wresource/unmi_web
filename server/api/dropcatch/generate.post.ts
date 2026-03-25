import { defineEventHandler, createError, readBody } from 'h3'
import { getAccountId } from '~/server/utils/account'
import { fetchRealDropDomains, markRefreshed, updateAuctionPrices } from '~/server/utils/dropcatch'
import { appraiseDomain } from '~/server/utils/appraisal'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  // Read optional parameters from request body
  const body = await readBody(event).catch(() => ({})) || {}
  const tlds = Array.isArray(body.tlds) ? body.tlds as string[] : ['.com', '.net', '.org']
  const domains = Array.isArray(body.domains) ? body.domains as string[] : undefined
  const maxPerTld = typeof body.maxPerTld === 'number' ? Math.min(body.maxPerTld, 100) : 100

  // Fetch real drop domains via RDAP checks
  const imported = await fetchRealDropDomains({
    tlds,
    maxPerTld,
    domains,
  })

  // Mark as refreshed after manual trigger
  markRefreshed()

  // Run appraisal engine on imported domains with no estimated value
  let appraised = 0
  if (imported > 0) {
    try {
      const db = useDatabase()
      const unvalued = db.prepare(
        'SELECT id, domain_name FROM drop_domains WHERE estimated_value = 0'
      ).all() as { id: number; domain_name: string }[]

      for (const d of unvalued) {
        try {
          const appraisal = appraiseDomain(d.domain_name)
          const parts = d.domain_name.split('.')
          const tld = '.' + parts.slice(1).join('.')
          const sld = parts[0]
          const len = sld.length
          db.prepare(
            'UPDATE drop_domains SET estimated_value = ? WHERE id = ?'
          ).run(appraisal.estimatedValue, d.id)
          appraised++
        } catch {
          // Skip domains that fail appraisal
        }
      }
    } catch (err) {
      console.warn('[dropcatch] Appraisal pass failed:', (err as Error).message)
    }
  }

  // Update auction_price with real registration prices from nazhumi.com
  let priced = 0
  try {
    priced = await updateAuctionPrices()
  } catch (err) {
    console.warn('[dropcatch] Price update failed:', (err as Error).message)
  }

  return { imported, appraised, priced }
})
