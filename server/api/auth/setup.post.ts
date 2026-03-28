import { defineEventHandler, readBody, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { useDatabase } from '~/server/database'
import { registerAccountKey } from '~/server/utils/keystore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password, confirmPassword, name } = body || {}

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: '密码至少需要6位' })
  }

  if (password !== confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: '两次输入的密码不一致' })
  }

  const db = useDatabase()

  // Check if this password already exists (hash comparison against all accounts)
  const accounts = db.prepare('SELECT id, password_hash FROM accounts').all() as { id: number; password_hash: string }[]
  for (const account of accounts) {
    if (bcrypt.compareSync(password, account.password_hash)) {
      throw createError({ statusCode: 409, statusMessage: '该密码已被使用，请选择其他密码' })
    }
  }

  const salt = bcrypt.genSaltSync(10)
  const passwordHash = bcrypt.hashSync(password, salt)
  const accountName = name?.trim() || `账号${accounts.length + 1}`

  const result = db.prepare(
    "INSERT INTO accounts (name, password_hash, created_at) VALUES (?, ?, datetime('now'))"
  ).run(accountName, passwordHash)

  // Generate unique verification token for this account
  const verifyToken = `unmi-verify=${randomBytes(16).toString('hex')}`
  db.prepare("UPDATE accounts SET verify_token = ? WHERE id = ?").run(verifyToken, result.lastInsertRowid)

  // Register encryption key for this session
  registerAccountKey(Number(result.lastInsertRowid), passwordHash)

  return {
    success: true,
    accountId: result.lastInsertRowid,
    accountName,
    message: '账号创建成功',
  }
})
