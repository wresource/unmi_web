import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const domainId = query.domain_id ? parseInt(query.domain_id as string) : null

  const db = useDatabase()

  let sql: string
  let params: any[]

  if (domainId) {
    sql = `
      SELECT r.*, d.domain_name
      FROM renewal_records r
      LEFT JOIN domains d ON r.domain_id = d.id
      WHERE r.domain_id = ?
      ORDER BY r.renewal_date DESC
    `
    params = [domainId]
  } else {
    sql = `
      SELECT r.*, d.domain_name
      FROM renewal_records r
      LEFT JOIN domains d ON r.domain_id = d.id
      ORDER BY r.renewal_date DESC
    `
    params = []
  }

  const records = db.prepare(sql).all(...params)

  return {
    data: records,
  }
})
