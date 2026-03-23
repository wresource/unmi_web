import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(() => {
  const db = useDatabase()
  const row = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number }

  return {
    initialized: row.cnt > 0,
    accountCount: row.cnt,
  }
})
