import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)

  const rows = db.prepare(
    'SELECT setting_key, setting_value FROM notification_settings WHERE account_id = ?'
  ).all(accountId) as { setting_key: string; setting_value: string }[]

  const settingsMap = new Map(rows.map(r => [r.setting_key, r.setting_value]))

  return {
    data: {
      smtp_host: settingsMap.get('smtp_host') || '',
      smtp_port: settingsMap.get('smtp_port') || '465',
      smtp_secure: settingsMap.get('smtp_secure') !== 'false',
      smtp_user: settingsMap.get('smtp_user') || '',
      has_password: !!(settingsMap.get('smtp_pass')),
      recipient_email: settingsMap.get('recipient_email') || '',
      email_expiry_7d: settingsMap.get('email_expiry_7d') !== 'false',
      email_expiry_30d: settingsMap.get('email_expiry_30d') !== 'false',
      email_expired: settingsMap.get('email_expired') !== 'false',
      email_summary_schedule: settingsMap.get('email_summary_schedule') || 'never',
    },
  }
})
