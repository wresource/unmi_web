import { defineEventHandler, readBody } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  const body = await readBody(event)

  const upsert = db.prepare(`
    INSERT INTO notification_settings (account_id, setting_key, setting_value)
    VALUES (?, ?, ?)
    ON CONFLICT(account_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value
  `)

  const allowedKeys = [
    'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass',
    'recipient_email', 'email_expiry_7d', 'email_expiry_30d', 'email_expired',
    'email_summary_schedule',
  ]

  const updateMany = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      upsert.run(accountId, key, value)
    }
  })

  const entries: [string, string][] = []
  for (const key of allowedKeys) {
    if (key in body) {
      // Only update smtp_pass if a non-empty value is provided
      if (key === 'smtp_pass' && !body[key]) continue
      entries.push([key, String(body[key])])
    }
  }

  if (entries.length > 0) {
    updateMany(entries)
  }

  return { success: true }
})
