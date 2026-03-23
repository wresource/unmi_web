import { defineEventHandler, setResponseHeader } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const db = useDatabase()

  const domains = db.prepare('SELECT * FROM domains ORDER BY domain_name ASC').all() as any[]

  // Attach tags to each domain
  const tagStmt = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    INNER JOIN domain_tags dt ON t.id = dt.tag_id
    WHERE dt.domain_id = ?
  `)

  const renewalStmt = db.prepare('SELECT * FROM renewal_records WHERE domain_id = ? ORDER BY renewal_date DESC')

  const enriched = domains.map((d) => ({
    ...d,
    tags: tagStmt.all(d.id),
    renewalRecords: renewalStmt.all(d.id),
  }))

  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="domains-export-${new Date().toISOString().slice(0, 10)}.json"`)

  return {
    exportDate: new Date().toISOString(),
    totalDomains: enriched.length,
    domains: enriched,
  }
})
