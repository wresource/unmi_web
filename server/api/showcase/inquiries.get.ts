import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  const query = getQuery(event)
  const status = (query.status as string || '').trim()
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))

  const db = useDatabase()

  const conditions: string[] = ['d.account_id = ?']
  const params: any[] = [accountId]

  if (status) {
    conditions.push('i.status = ?')
    params.push(status)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM inquiries i
    LEFT JOIN domains d ON d.id = i.domain_id
    WHERE ${where}
  `).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT i.* FROM inquiries i
    LEFT JOIN domains d ON d.id = i.domain_id
    WHERE ${where}
    ORDER BY i.created_at DESC
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
