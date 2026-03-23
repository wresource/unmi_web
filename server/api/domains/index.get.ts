import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const query = getQuery(event)
  const accountId = getAccountId(event)

  const search = (query.search as string) || ''
  const registrar = (query.registrar as string) || ''
  const status = (query.status as string) || ''
  const tld = (query.tld as string) || ''
  const tag = (query.tag as string) || ''
  const expireDays = query.expireDays ? parseInt(query.expireDays as string) : 0
  const sortBy = (query.sortBy as string) || 'expiry_date'
  const sortOrder = (query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))

  const allowedSortColumns = ['domain_name', 'expiry_date', 'registration_date', 'purchase_price', 'renewal_price', 'created_at', 'updated_at', 'status', 'registrar', 'tld']
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'expiry_date'

  const conditions: string[] = ['d.account_id = ?']
  const params: any[] = [accountId]

  if (search) {
    conditions.push('d.domain_name LIKE ?')
    params.push(`%${search}%`)
  }
  if (registrar) {
    conditions.push('d.registrar = ?')
    params.push(registrar)
  }
  if (status) {
    conditions.push('d.status = ?')
    params.push(status)
  }
  if (tld) {
    conditions.push('d.tld = ?')
    params.push(tld)
  }
  if (expireDays > 0) {
    conditions.push("d.expiry_date IS NOT NULL AND d.expiry_date != '' AND d.expiry_date <= date('now', '+' || ? || ' days')")
    params.push(expireDays)
  }

  let joinClause = ''
  if (tag) {
    joinClause = 'INNER JOIN domain_tags dt ON d.id = dt.domain_id INNER JOIN tags t ON dt.tag_id = t.id'
    conditions.push('t.name = ?')
    params.push(tag)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  // Count total
  const countSql = `SELECT COUNT(DISTINCT d.id) as total FROM domains d ${joinClause} ${whereClause}`
  const countRow = db.prepare(countSql).get(...params) as { total: number }
  const total = countRow.total

  // Fetch data
  const offset = (page - 1) * pageSize
  const dataSql = `
    SELECT DISTINCT d.*
    FROM domains d
    ${joinClause}
    ${whereClause}
    ORDER BY d.${safeSortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `
  const dataParams = [...params, pageSize, offset]
  const domains = db.prepare(dataSql).all(...dataParams) as any[]

  // Calculate remainingDays and attach tags
  const now = new Date()
  const tagStmt = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    INNER JOIN domain_tags dt ON t.id = dt.tag_id
    WHERE dt.domain_id = ?
  `)

  const enriched = domains.map((d) => {
    let remainingDays: number | null = null
    if (d.expiry_date) {
      const expiry = new Date(d.expiry_date)
      remainingDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }
    const tags = tagStmt.all(d.id)
    return { ...d, remainingDays, tags }
  })

  return {
    data: enriched,
    total,
    page,
    pageSize,
  }
})
