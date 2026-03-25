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

  const updateMany = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      upsert.run(accountId, key, String(value))
    }
  })

  const entries = Object.entries(body).map(([k, v]) => [k, String(v)] as [string, string])
  updateMany(entries)

  return { success: true }
})
