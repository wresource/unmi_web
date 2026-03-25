import { defineEventHandler, getHeader, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const passkeyId = Number(getRouterParam(event, 'id'))
  if (!passkeyId) {
    throw createError({ statusCode: 400, statusMessage: '无效的通行密钥ID' })
  }

  const db = useDatabase()

  const result = db.prepare(
    'DELETE FROM passkey_credentials WHERE id = ? AND account_id = ?'
  ).run(passkeyId, accountId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: '通行密钥不存在' })
  }

  // If no passkeys left, disable passkey auth
  const remaining = db.prepare(
    'SELECT COUNT(*) as cnt FROM passkey_credentials WHERE account_id = ?'
  ).get(accountId) as { cnt: number }

  if (remaining.cnt === 0) {
    db.prepare('UPDATE accounts SET passkey_enabled = 0 WHERE id = ?').run(accountId)
  }

  return { success: true }
})
