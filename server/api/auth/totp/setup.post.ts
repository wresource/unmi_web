import { defineEventHandler, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { generateTOTPSecret, generateBackupCodes } from '~/server/utils/totp'
import QRCode from 'qrcode'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const db = useDatabase()

  const account = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(accountId) as { id: number; name: string } | undefined
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '账号不存在' })
  }

  const { secret, uri } = generateTOTPSecret(account.name)
  const backupCodes = generateBackupCodes()

  // Upsert totp_config with is_enabled=0
  db.prepare(`
    INSERT INTO totp_config (account_id, secret, is_enabled, backup_codes)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      secret = excluded.secret,
      is_enabled = 0,
      backup_codes = excluded.backup_codes
  `).run(accountId, secret, JSON.stringify(backupCodes))

  const qrCodeDataUrl = await QRCode.toDataURL(uri)

  return {
    secret,
    qrCodeDataUrl,
    backupCodes,
  }
})
