import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  const query = getQuery(event)

  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))
  const type = (query.type as string) || ''
  const isRead = query.is_read !== undefined ? parseInt(query.is_read as string) : -1

  const conditions: string[] = ['account_id = ?']
  const params: any[] = [accountId]

  if (type) {
    conditions.push('type = ?')
    params.push(type)
  }
  if (isRead >= 0) {
    conditions.push('is_read = ?')
    params.push(isRead)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM notifications ${whereClause}`).get(...params) as { total: number }
  const total = countRow.total

  const unreadRow = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE account_id = ? AND is_read = 0').get(accountId) as { cnt: number }
  const unread_count = unreadRow.cnt

  const offset = (page - 1) * pageSize
  const data = db.prepare(`
    SELECT * FROM notifications ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return { data, total, unread_count }
})
