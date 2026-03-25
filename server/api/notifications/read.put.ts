import { defineEventHandler, readBody } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  const body = await readBody(event)

  if (body.all) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE account_id = ? AND is_read = 0').run(accountId)
  } else if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const placeholders = body.ids.map(() => '?').join(',')
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE account_id = ? AND id IN (${placeholders})`).run(accountId, ...body.ids)
  }

  return { success: true }
})
