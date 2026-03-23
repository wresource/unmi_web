import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const type = query.type as string | undefined
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50))

  const db = useDatabase()

  let sql: string
  let params: any[]

  if (type && ['export', 'import', 'sync'].includes(type)) {
    sql = 'SELECT * FROM sync_backup_logs WHERE type = ? ORDER BY created_at DESC LIMIT ?'
    params = [type, limit]
  } else {
    sql = 'SELECT * FROM sync_backup_logs ORDER BY created_at DESC LIMIT ?'
    params = [limit]
  }

  const logs = db.prepare(sql).all(...params)

  return {
    data: logs,
  }
})
