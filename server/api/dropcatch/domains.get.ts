import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const query = getQuery(event)

  const search = (query.search as string) || ''
  const tld = (query.tld as string) || ''
  const minLength = query.minLength ? parseInt(query.minLength as string) : 0
  const maxLength = query.maxLength ? parseInt(query.maxLength as string) : 0
  const maxPrice = query.maxPrice ? parseInt(query.maxPrice as string) : 0
  const status = (query.status as string) || ''
  const hasNumbers = (query.hasNumbers as string) || ''
  const hasHyphens = (query.hasHyphens as string) || ''
  const pureLetters = (query.pureLetters as string) || ''
  const pureNumbers = (query.pureNumbers as string) || ''
  const sortBy = (query.sortBy as string) || 'drop_date'
  const sortOrder = (query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))

  const allowedSort = ['domain_name', 'drop_date', 'estimated_value', 'domain_length', 'created_at']
  const safeSortBy = allowedSort.includes(sortBy) ? sortBy : 'drop_date'

  const conditions: string[] = []
  const params: any[] = []

  if (search) {
    conditions.push('domain_name LIKE ?')
    params.push(`%${search}%`)
  }
  if (tld) {
    conditions.push('tld = ?')
    params.push(tld)
  }
  if (minLength > 0) {
    conditions.push('domain_length >= ?')
    params.push(minLength)
  }
  if (maxLength > 0) {
    conditions.push('domain_length <= ?')
    params.push(maxLength)
  }
  if (maxPrice > 0) {
    conditions.push('estimated_value <= ?')
    params.push(maxPrice)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (hasNumbers === '1') {
    conditions.push('has_numbers = 1')
  } else if (hasNumbers === '0') {
    conditions.push('has_numbers = 0')
  }
  if (hasHyphens === '0') {
    conditions.push('has_hyphens = 0')
  }
  if (pureLetters === '1') {
    conditions.push('is_pure_letters = 1')
  }
  if (pureNumbers === '1') {
    conditions.push('is_pure_numbers = 1')
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM drop_domains ${whereClause}`).get(...params) as { total: number }
  const total = countRow.total

  const offset = (page - 1) * pageSize
  const data = db.prepare(`
    SELECT * FROM drop_domains ${whereClause}
    ORDER BY ${safeSortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[]

  // Calculate days until drop
  const now = new Date()
  const enriched = data.map(d => {
    let daysUntilDrop: number | null = null
    if (d.drop_date) {
      const dropDate = new Date(d.drop_date)
      daysUntilDrop = Math.ceil((dropDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }
    return { ...d, days_until_drop: daysUntilDrop }
  })

  // Get distinct TLDs for filter dropdown
  const tlds = db.prepare('SELECT DISTINCT tld FROM drop_domains ORDER BY tld').all() as { tld: string }[]

  return {
    data: enriched,
    total,
    page,
    pageSize,
    tlds: tlds.map(t => t.tld),
  }
})
