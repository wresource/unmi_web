import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)

  const data = db.prepare(`
    SELECT * FROM domain_watchlist
    WHERE account_id = ?
    ORDER BY created_at DESC
  `).all(accountId) as any[]

  return { data }
})
