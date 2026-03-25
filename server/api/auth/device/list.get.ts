import { defineEventHandler, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const db = useDatabase()

  const devices = db.prepare(
    'SELECT id, device_id, device_name, device_fingerprint, user_agent, last_used_at, created_at FROM device_auth WHERE account_id = ? ORDER BY last_used_at DESC'
  ).all(accountId)

  return { devices }
})
