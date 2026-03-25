import { defineEventHandler, createError, readBody } from 'h3'
import { getAccountId } from '~/server/utils/account'
import { fetchRealDropDomains, markRefreshed } from '~/server/utils/dropcatch'
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
          // Auction price: ~15% of estimated value with minimums by length/tld
          let auctionPrice = Math.round(appraisal.estimatedValue * 0.15)
          if (tld === '.com') {
            if (len <= 2) auctionPrice = Math.max(auctionPrice, 5000)
            else if (len === 3) auctionPrice = Math.max(auctionPrice, 500)
            else if (len === 4) auctionPrice = Math.max(auctionPrice, 100)
            else auctionPrice = Math.max(auctionPrice, 30)
          } else {
            if (len <= 3) auctionPrice = Math.max(auctionPrice, 200)
            else auctionPrice = Math.max(auctionPrice, 20)
          }
          if (auctionPrice >= 1000) auctionPrice = Math.round(auctionPrice / 100) * 100
          else if (auctionPrice >= 100) auctionPrice = Math.round(auctionPrice / 10) * 10

          db.prepare(
            'UPDATE drop_domains SET estimated_value = ?, auction_price = ? WHERE id = ?'
          ).run(appraisal.estimatedValue, auctionPrice, d.id)
          appraised++
        } catch {
          // Skip domains that fail appraisal
        }
      }
    } catch (err) {
      console.warn('[dropcatch] Appraisal pass failed:', (err as Error).message)
    }
  }

  return { imported, appraised }
})
