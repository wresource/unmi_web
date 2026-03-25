import { defineEventHandler, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { createAuthenticationOptions } from '~/server/utils/webauthn'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const credentials = db.prepare(
    'SELECT credential_id FROM passkey_credentials'
  ).all() as { credential_id: string }[]

  if (credentials.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '没有已注册的通行密钥' })
  }

  const options = await createAuthenticationOptions(
    credentials.map(c => c.credential_id),
  )

  return options
})
