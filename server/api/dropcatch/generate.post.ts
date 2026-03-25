import { defineEventHandler, createError, readBody } from 'h3'
import { getAccountId } from '~/server/utils/account'
import { fetchRealDropDomains } from '~/server/utils/dropcatch'
import { appraiseDomain } from '~/server/utils/appraisal'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  // Read optional parameters from request body
  const body = await readBody(event).catch(() => ({})) || {}
  const tlds = Array.isArray(body.tlds) ? body.tlds as string[] : undefined
  const domains = Array.isArray(body.domains) ? body.domains as string[] : undefined

  // Fetch real drop domains via RDAP checks
  const imported = await fetchRealDropDomains({
    tlds,
    domains,
  })

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

  return { imported, appraised }
})
