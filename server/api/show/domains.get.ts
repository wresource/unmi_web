import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = (query.search as string || '').trim()
  const tld = (query.tld as string || '').trim()
  const category = parseInt(query.category as string) || 0
  const priceMin = parseFloat(query.price_min as string) || 0
  const priceMax = parseFloat(query.price_max as string) || 0
  const lengthMin = parseInt(query.length_min as string) || 0
  const lengthMax = parseInt(query.length_max as string) || 0
  const priceType = (query.price_type as string || '').trim()
  const sort = (query.sort as string || 'recommended')
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))

  const db = useDatabase()
  const conditions: string[] = [
    'd.is_public = 1',
    'd.is_verified = 1',
    'a.is_public = 1',
    "a.name != ''",
  ]
  const params: any[] = []

  if (search) {
    conditions.push('d.domain_name LIKE ?')
    params.push(`%${search}%`)
  }
  if (tld) {
    conditions.push('d.tld = ?')
    params.push(tld)
  }
  if (category) {
    conditions.push('d.show_category_id = ?')
    params.push(category)
  }
  if (priceMin > 0) {
    conditions.push('d.show_price >= ?')
    params.push(priceMin)
  }
  if (priceMax > 0) {
    conditions.push('d.show_price <= ?')
    params.push(priceMax)
  }
  if (lengthMin > 0) {
    conditions.push('LENGTH(SUBSTR(d.domain_name, 1, INSTR(d.domain_name, ".") - 1)) >= ?')
    params.push(lengthMin)
  }
  if (lengthMax > 0) {
    conditions.push('LENGTH(SUBSTR(d.domain_name, 1, INSTR(d.domain_name, ".") - 1)) <= ?')
    params.push(lengthMax)
  }
  if (priceType) {
    conditions.push('d.price_type = ?')
    params.push(priceType)
  }

  let orderBy = 'd.is_featured DESC, d.view_count DESC'
  switch (sort) {
    case 'newest': orderBy = 'd.created_at DESC'; break
    case 'price_asc': orderBy = 'd.show_price ASC'; break
    case 'price_desc': orderBy = 'd.show_price DESC'; break
    case 'length': orderBy = 'LENGTH(SUBSTR(d.domain_name, 1, INSTR(d.domain_name, ".") - 1)) ASC'; break
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM domains d
    JOIN accounts a ON a.id = d.account_id
    WHERE ${where}
  `).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT
      d.domain_name, d.tld, d.show_price, d.price_type, d.show_description,
      d.is_featured, d.view_count, d.show_category_id, d.status,
      sc.name as category_name
    FROM domains d
    JOIN accounts a ON a.id = d.account_id
    LEFT JOIN show_categories sc ON sc.id = d.show_category_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[]

  // Attach tags
  const domainNames = rows.map(r => r.domain_name)
  const tagsMap: Record<string, string[]> = {}
  if (domainNames.length > 0) {
    const placeholders = domainNames.map(() => '?').join(',')
    const tagRows = db.prepare(`
      SELECT d.domain_name, t.name as tag_name FROM domain_tags dt
      JOIN tags t ON t.id = dt.tag_id
      JOIN domains d ON d.id = dt.domain_id
      WHERE d.domain_name IN (${placeholders}) AND d.is_public = 1
    `).all(...domainNames) as any[]
    for (const tr of tagRows) {
      if (!tagsMap[tr.domain_name]) tagsMap[tr.domain_name] = []
      tagsMap[tr.domain_name].push(tr.tag_name)
    }
  }

  const data = rows.map(r => ({
    ...r,
    tags: tagsMap[r.domain_name] || [],
  }))

  return {
    success: true,
    data,
    total: countRow.total,
    page,
    pageSize,
  }
})
