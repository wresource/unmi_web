import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { useDatabase } from '~/server/database'
import { generateBackupCodes } from '~/server/utils/totp'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const body = await readBody(event)
  const { password } = body || {}

  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请输入密码' })
  }

  const db = useDatabase()

  const account = db.prepare('SELECT password_hash FROM accounts WHERE id = ?').get(accountId) as { password_hash: string } | undefined
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '账号不存在' })
  }

  if (!bcrypt.compareSync(password, account.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: '密码错误' })
  }

  const backupCodes = generateBackupCodes()

  db.prepare(
    'UPDATE totp_config SET backup_codes = ? WHERE account_id = ?'
  ).run(JSON.stringify(backupCodes), accountId)

  return { backupCodes }
})
