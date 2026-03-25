import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  const query = getQuery(event)

  const domainId = query.domain_id ? parseInt(query.domain_id as string) : 0
  const granularity = (query.granularity as string) || 'day'
  const startDate = (query.start_date as string) || ''
  const endDate = (query.end_date as string) || ''

  let dateExpr = 'dv.view_date'
  if (granularity === 'week') {
    dateExpr = "strftime('%Y-W%W', dv.view_date)"
  } else if (granularity === 'month') {
    dateExpr = "strftime('%Y-%m', dv.view_date)"
  }

  const conditions: string[] = []
  const params: any[] = []

  if (domainId) {
    conditions.push('dv.domain_id = ?')
    params.push(domainId)
  } else {
    // All public domains belonging to the account
    conditions.push('d.account_id = ?')
    params.push(accountId)
  }

  if (startDate) {
    conditions.push('dv.view_date >= ?')
    params.push(startDate)
  }
  if (endDate) {
    conditions.push('dv.view_date <= ?')
    params.push(endDate)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const joinClause = domainId ? '' : 'JOIN domains d ON d.id = dv.domain_id'

  const data = db.prepare(`
    SELECT ${dateExpr} as date, SUM(dv.view_count) as views
    FROM domain_views dv
    ${joinClause}
    ${whereClause}
    GROUP BY ${dateExpr}
    ORDER BY date ASC
  `).all(...params) as { date: string; views: number }[]

  // Total views
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(dv.view_count), 0) as total_views
    FROM domain_views dv
    ${joinClause}
    ${whereClause}
  `).get(...params) as { total_views: number }

  // Top viewed domains
  const topConditions: string[] = ['d.account_id = ?']
  const topParams: any[] = [accountId]
  if (startDate) {
    topConditions.push('dv.view_date >= ?')
    topParams.push(startDate)
  }
  if (endDate) {
    topConditions.push('dv.view_date <= ?')
    topParams.push(endDate)
  }
  const topWhereClause = 'WHERE ' + topConditions.join(' AND ')

  const topDomains = db.prepare(`
    SELECT d.id, d.domain_name, SUM(dv.view_count) as total_views
    FROM domain_views dv
    JOIN domains d ON d.id = dv.domain_id
    ${topWhereClause}
    GROUP BY d.id, d.domain_name
    ORDER BY total_views DESC
    LIMIT 10
  `).all(...topParams)

  return { data, total_views: totalRow.total_views, top_domains: topDomains }
})
