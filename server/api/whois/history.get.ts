import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async () => {
  const db = useDatabase()
  const rows = db.prepare(`
    SELECT id, domain_name as domain, status, queried_at
    FROM whois_query_logs
    ORDER BY queried_at DESC
    LIMIT 20
  `).all()

  return rows
})
