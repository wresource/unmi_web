import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be an object of key-value pairs' })
  }

  // Prevent overwriting sensitive keys via this endpoint
  const protectedKeys = ['password_hash', 'device_key']
  const db = useDatabase()

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `)

  db.transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      if (protectedKeys.includes(key)) continue
      upsert.run(key, String(value))
    }
  })()

  // Return updated settings
  const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT IN ('password_hash', 'device_key')").all() as { key: string; value: string }[]
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  return {
    success: true,
    data: settings,
  }
})
