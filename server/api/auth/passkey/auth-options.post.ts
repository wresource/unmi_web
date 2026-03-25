import { defineEventHandler, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { createAuthenticationOptions } from '~/server/utils/webauthn'

export default defineEventHandler(async (event) => {
  const db = useDatabase()

  const credentials = db.prepare(
    'SELECT credential_id FROM passkey_credentials'
  ).all() as { credential_id: string }[]

  if (credentials.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No passkeys registered' })
  }

  // Don't pass allowCredentials — let the browser discover credentials
  // from iCloud Keychain, Windows Hello, etc. This enables cross-device
  // passkey usage (e.g., registered on Mac, used on iPhone via iCloud sync)
  const options = await createAuthenticationOptions()

  return options
})
