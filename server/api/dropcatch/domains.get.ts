import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { needsRefresh, fetchDropDomains, markRefreshed } from '~/server/utils/dropcatch'
import { isDropCatchConfigured } from '~/server/utils/dropcatch-api'

export default defineEventHandler(async (event) => {
  // Check if API is configured
  const configured = isDropCatchConfigured()

  // Auto-refresh once per day — runs in background, does NOT block this response
  if (configured && needsRefresh()) {
    markRefreshed() // Mark immediately to prevent concurrent triggers
    fetchDropDomains({ tlds: ['.com', '.net', '.org'], maxPerTld: 2000 })
      .then(count => console.log(`[dropcatch] Auto-refresh complete: ${count} domains`))
      .catch(err => console.warn('[dropcatch] Auto-refresh failed:', err.message))
  }

  const db = useDatabase()
  const query = getQuery(event)

  const search = (query.search as string) || ''
  const tld = (query.tld as string) || ''
  const minLength = query.minLength ? parseInt(query.minLength as string) : 0
  const maxLength = query.maxLength ? parseInt(query.maxLength as string) : 0
  const maxPrice = query.maxPrice ? parseInt(query.maxPrice as string) : 0
  const status = (query.status as string) || ''
  const dropWithin = query.dropWithin !== undefined ? parseInt(query.dropWithin as string) : -1
  const sortBy = (query.sortBy as string) || 'drop_date'
  const sortOrder = (query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize as string) || 50))

  const allowedSort = ['domain_name', 'drop_date', 'estimated_value', 'domain_length', 'auction_price', 'created_at']
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
    conditions.push('auction_price <= ?')
    params.push(maxPrice)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  // Drop within N days filter
  if (dropWithin >= 0) {
    const now = new Date()
    const futureDate = new Date(now.getTime() + dropWithin * 86400000)
    if (dropWithin === 0) {
      const tomorrow = new Date(now.getTime() + 86400000)
      conditions.push("drop_date != ''")
      conditions.push("drop_date <= ?")
      params.push(tomorrow.toISOString())
    } else {
      conditions.push("drop_date != ''")
      conditions.push("drop_date <= ?")
      params.push(futureDate.toISOString())
    }
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

  // Get distinct TLDs for filter dropdown
  const tlds = db.prepare('SELECT DISTINCT tld FROM drop_domains ORDER BY tld').all() as { tld: string }[]

  // Get last refresh time
  const refreshRow = db.prepare(
    "SELECT setting_value FROM notification_settings WHERE account_id = 0 AND setting_key = 'dropcatch_last_refresh'"
  ).get() as { setting_value: string } | undefined

  return {
    data,
    total,
    page,
    pageSize,
    tlds: tlds.map(t => t.tld),
    lastRefresh: refreshRow?.setting_value || null,
    configured,
  }
})
