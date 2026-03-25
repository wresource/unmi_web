import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { verifyRegistration } from '~/server/utils/webauthn'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const body = await readBody(event)
  const { response, deviceName } = body || {}

  if (!response) {
    throw createError({ statusCode: 400, statusMessage: '缺少注册响应数据' })
  }

  const db = useDatabase()

  try {
    const verification = await verifyRegistration(accountId, response)

    if (!verification.verified || !verification.registrationInfo) {
      throw createError({ statusCode: 400, statusMessage: '验证失败' })
    }

    const { credential } = verification.registrationInfo

    const credentialIdBase64url = Buffer.from(credential.id).toString('base64url')
    const publicKeyBase64url = Buffer.from(credential.publicKey).toString('base64url')

    db.prepare(`
      INSERT INTO passkey_credentials (account_id, credential_id, public_key, counter, device_name, transports)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      accountId,
      credentialIdBase64url,
      publicKeyBase64url,
      credential.counter,
      deviceName || '',
      JSON.stringify(response.response?.transports || []),
    )

    db.prepare('UPDATE accounts SET passkey_enabled = 1 WHERE id = ?').run(accountId)

    return { success: true }
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || '注册失败' })
  }
})
