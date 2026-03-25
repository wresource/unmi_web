import { defineEventHandler, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const db = useDatabase()

  const passkeys = db.prepare(
    'SELECT id, credential_id, device_name, transports, created_at, last_used_at FROM passkey_credentials WHERE account_id = ? ORDER BY created_at DESC'
  ).all(accountId)

  return { passkeys }
})
