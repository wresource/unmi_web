import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)

  const rows = db.prepare('SELECT setting_key, setting_value FROM notification_settings WHERE account_id = ?').all(accountId) as { setting_key: string; setting_value: string }[]

  const defaults: Record<string, string> = {
    expiry_7d_enabled: 'true',
    expiry_30d_enabled: 'true',
    daily_summary_enabled: 'true',
  }

  const settings: Record<string, string> = { ...defaults }
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value
  }

  return { data: settings }
})
