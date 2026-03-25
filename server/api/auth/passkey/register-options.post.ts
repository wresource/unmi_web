import { defineEventHandler, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { createRegistrationOptions } from '~/server/utils/webauthn'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const db = useDatabase()

  const account = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(accountId) as { id: number; name: string } | undefined
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: '账号不存在' })
  }

  const existingCreds = db.prepare(
    'SELECT credential_id FROM passkey_credentials WHERE account_id = ?'
  ).all(accountId) as { credential_id: string }[]

  const options = await createRegistrationOptions(
    accountId,
    account.name,
    existingCreds.map(c => c.credential_id),
  )

  return options
})
