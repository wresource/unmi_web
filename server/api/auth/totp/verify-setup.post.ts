import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { verifyTOTP } from '~/server/utils/totp'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const body = await readBody(event)
  const { token } = body || {}

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请输入验证码' })
  }

  const db = useDatabase()

  const config = db.prepare(
    'SELECT secret FROM totp_config WHERE account_id = ?'
  ).get(accountId) as { secret: string } | undefined

  if (!config) {
    throw createError({ statusCode: 400, statusMessage: '请先设置 TOTP' })
  }

  if (!verifyTOTP(config.secret, token)) {
    throw createError({ statusCode: 401, statusMessage: '验证码错误' })
  }

  db.prepare('UPDATE totp_config SET is_enabled = 1 WHERE account_id = ?').run(accountId)
  db.prepare('UPDATE accounts SET totp_enabled = 1 WHERE id = ?').run(accountId)

  return { success: true }
})
