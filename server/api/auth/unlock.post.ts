import { defineEventHandler, readBody, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { useDatabase } from '~/server/database'
import { registerAccountKey } from '~/server/utils/keystore'
import { verifyTOTP, verifyBackupCode } from '~/server/utils/totp'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password, deviceId, totpCode, backupCode } = body || {}

  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请输入密码' })
  }

  const db = useDatabase()

  // Find matching account by comparing password against all accounts
  const accounts = db.prepare('SELECT id, name, password_hash, totp_enabled, device_auth_enabled FROM accounts').all() as {
    id: number
    name: string
    password_hash: string
    totp_enabled: number
    device_auth_enabled: number
  }[]

  if (accounts.length === 0) {
    throw createError({ statusCode: 403, statusMessage: '系统尚未创建任何账号' })
  }

  for (const account of accounts) {
    if (bcrypt.compareSync(password, account.password_hash)) {
      // Check if device auth is enabled and device is authorized
      if (account.device_auth_enabled && deviceId) {
        const device = db.prepare(
          'SELECT id FROM device_auth WHERE account_id = ? AND device_id = ?'
        ).get(account.id, deviceId) as { id: number } | undefined

        if (device) {
          // Authorized device found - update last_used_at and skip TOTP
          db.prepare(
            "UPDATE device_auth SET last_used_at = datetime('now') WHERE account_id = ? AND device_id = ?"
          ).run(account.id, deviceId)

          registerAccountKey(account.id, account.password_hash)
          return {
            success: true,
            accountId: account.id,
            accountName: account.name,
          }
        }
      }

      // Check if TOTP is enabled
      if (account.totp_enabled) {
        const totpConfig = db.prepare(
          'SELECT secret, backup_codes, is_enabled FROM totp_config WHERE account_id = ? AND is_enabled = 1'
        ).get(account.id) as { secret: string; backup_codes: string; is_enabled: number } | undefined

        if (totpConfig) {
          // If neither TOTP code nor backup code provided, signal client to prompt for it
          if (!totpCode && !backupCode) {
            return {
              requiresTOTP: true,
              accountId: account.id,
              accountName: account.name,
            }
          }

          // Verify TOTP code
          if (totpCode) {
            if (!verifyTOTP(totpConfig.secret, totpCode)) {
              throw createError({ statusCode: 401, statusMessage: '验证码错误' })
            }
          }

          // Verify backup code
          if (backupCode && !totpCode) {
            const result = verifyBackupCode(totpConfig.backup_codes, backupCode)
            if (!result.valid) {
              throw createError({ statusCode: 401, statusMessage: '备用码错误' })
            }
            // Update remaining backup codes
            db.prepare(
              'UPDATE totp_config SET backup_codes = ? WHERE account_id = ?'
            ).run(JSON.stringify(result.remainingCodes), account.id)
          }
        }
      }

      // All checks passed - complete login
      registerAccountKey(account.id, account.password_hash)

      return {
        success: true,
        accountId: account.id,
        accountName: account.name,
      }
    }
  }

  throw createError({ statusCode: 401, statusMessage: '密码错误' })
})
