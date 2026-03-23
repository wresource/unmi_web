import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Account ID required' })
  }

  const id = parseInt(event.context.params?.id || '0')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Domain ID required' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  // Verify ownership
  const domain = db.prepare('SELECT * FROM domains WHERE id = ? AND account_id = ?').get(id, accountId) as any
  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  const setClauses: string[] = []
  const setParams: any[] = []

  if (body.is_public !== undefined) {
    setClauses.push('is_public = ?')
    setParams.push(body.is_public ? 1 : 0)
  }
  if (body.show_price !== undefined) {
    setClauses.push('show_price = ?')
    setParams.push(body.show_price)
  }
  if (body.price_type !== undefined) {
    setClauses.push('price_type = ?')
    setParams.push(body.price_type)
  }
  if (body.show_description !== undefined) {
    setClauses.push('show_description = ?')
    setParams.push(body.show_description)
  }
  if (body.show_category_id !== undefined) {
    setClauses.push('show_category_id = ?')
    setParams.push(body.show_category_id)
  }
  if (body.is_featured !== undefined) {
    setClauses.push('is_featured = ?')
    setParams.push(body.is_featured ? 1 : 0)
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  setClauses.push("updated_at = datetime('now')")

  db.prepare(`UPDATE domains SET ${setClauses.join(', ')} WHERE id = ?`).run(...setParams, id)

  const updated = db.prepare('SELECT * FROM domains WHERE id = ?').get(id)

  return {
    success: true,
    data: updated,
  }
})
