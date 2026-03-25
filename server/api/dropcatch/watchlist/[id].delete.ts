import { defineEventHandler, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  const id = parseInt(event.context.params?.id || '0')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
  }

  const result = db.prepare('DELETE FROM domain_watchlist WHERE id = ? AND account_id = ?').run(id, accountId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Watchlist item not found' })
  }

  return { success: true }
})
