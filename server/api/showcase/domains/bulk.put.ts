import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Account ID required' })
  }

  const body = await readBody(event)

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'ids array is required' })
  }

  const db = useDatabase()

  const setClauses: string[] = []
  const setParams: any[] = []

  if (body.is_public !== undefined) {
    setClauses.push('is_public = ?')
    setParams.push(body.is_public ? 1 : 0)
  }
  if (body.is_featured !== undefined) {
    setClauses.push('is_featured = ?')
    setParams.push(body.is_featured ? 1 : 0)
  }
  if (body.show_category_id !== undefined) {
    setClauses.push('show_category_id = ?')
    setParams.push(body.show_category_id)
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  setClauses.push("updated_at = datetime('now')")

  const placeholders = body.ids.map(() => '?').join(',')
  const sql = `UPDATE domains SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) AND account_id = ?`

  const result = db.prepare(sql).run(...setParams, ...body.ids, accountId)

  return {
    success: true,
    updated: result.changes,
  }
})
