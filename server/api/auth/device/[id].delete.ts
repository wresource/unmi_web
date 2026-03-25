import { defineEventHandler, getHeader, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const deviceDbId = Number(getRouterParam(event, 'id'))
  if (!deviceDbId) {
    throw createError({ statusCode: 400, statusMessage: '无效的设备ID' })
  }

  const db = useDatabase()

  const result = db.prepare(
    'DELETE FROM device_auth WHERE id = ? AND account_id = ?'
  ).run(deviceDbId, accountId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: '设备不存在' })
  }

  // If no devices left, disable device auth
  const remaining = db.prepare(
    'SELECT COUNT(*) as cnt FROM device_auth WHERE account_id = ?'
  ).get(accountId) as { cnt: number }

  if (remaining.cnt === 0) {
    db.prepare('UPDATE accounts SET device_auth_enabled = 0 WHERE id = ?').run(accountId)
  }

  return { success: true }
})
