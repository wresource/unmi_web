import { defineEventHandler, readBody, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { useDatabase } from '~/server/database'
import { registerAccountKey } from '~/server/utils/keystore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body || {}

  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请输入密码' })
  }

  const db = useDatabase()

  // Find matching account by comparing password against all accounts
  const accounts = db.prepare('SELECT id, name, password_hash FROM accounts').all() as {
    id: number
    name: string
    password_hash: string
  }[]

  if (accounts.length === 0) {
    throw createError({ statusCode: 403, statusMessage: '系统尚未创建任何账号' })
  }

  for (const account of accounts) {
    if (bcrypt.compareSync(password, account.password_hash)) {
      // Register encryption key for this session
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
