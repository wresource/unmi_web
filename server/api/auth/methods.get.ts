import { defineEventHandler, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const db = useDatabase()

  const account = db.prepare(
    'SELECT totp_enabled, device_auth_enabled, passkey_enabled FROM accounts WHERE id = ?'
  ).get(accountId) as { totp_enabled: number; device_auth_enabled: number; passkey_enabled: number } | undefined

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '账号不存在' })
  }

  const deviceCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM device_auth WHERE account_id = ?'
  ).get(accountId) as { cnt: number }).cnt

  const passkeyCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM passkey_credentials WHERE account_id = ?'
  ).get(accountId) as { cnt: number }).cnt

  return {
    totp: !!account.totp_enabled,
    deviceAuth: !!account.device_auth_enabled,
    passkey: !!account.passkey_enabled,
    deviceCount,
    passkeyCount,
  }
})
