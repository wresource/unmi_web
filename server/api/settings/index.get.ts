import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(() => {
  const db = useDatabase()

  const rows = db.prepare("SELECT key, value, updated_at FROM settings WHERE key NOT IN ('password_hash', 'device_key')").all() as { key: string; value: string; updated_at: string }[]

  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  return {
    data: settings,
  }
})
