import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'
import { analyzeDomain } from '~/server/utils/dropcatch'

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readBody(event)
  const domainName = body?.domain_name?.trim()?.toLowerCase()
  const note = body?.note || ''

  if (!domainName) {
    throw createError({ statusCode: 400, statusMessage: 'domain_name is required' })
  }

  const analysis = analyzeDomain(domainName)

  try {
    db.prepare(`
      INSERT INTO domain_watchlist (account_id, domain_name, tld, note)
      VALUES (?, ?, ?, ?)
    `).run(accountId, domainName, analysis.tld, note)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      throw createError({ statusCode: 409, statusMessage: 'Domain already in watchlist' })
    }
    throw e
  }

  return { success: true }
})
