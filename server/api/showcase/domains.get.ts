import { defineEventHandler, getQuery, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Account ID required' })
  }

  const query = getQuery(event)
  const search = (query.search as string || '').trim()
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))

  const db = useDatabase()
  const conditions: string[] = ['d.account_id = ?']
  const params: any[] = [accountId]

  if (search) {
    conditions.push('d.domain_name LIKE ?')
    params.push(`%${search}%`)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM domains d WHERE ${where}
  `).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT
      d.id, d.domain_name, d.tld, d.is_public, d.show_price, d.price_type,
      d.show_description, d.is_featured, d.show_category_id,
      sc.name as category_name
    FROM domains d
    LEFT JOIN show_categories sc ON sc.id = d.show_category_id
    WHERE ${where}
    ORDER BY d.domain_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return {
    success: true,
    data: rows,
    total: countRow.total,
    page,
    pageSize,
  }
})
