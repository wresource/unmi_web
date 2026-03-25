import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { verifyAuthentication } from '~/server/utils/webauthn'
import { registerAccountKey } from '~/server/utils/keystore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { response } = body || {}

  if (!response) {
    throw createError({ statusCode: 400, statusMessage: '缺少认证响应数据' })
  }

  const db = useDatabase()

  // Find credential by id
  const credential = db.prepare(
    'SELECT id, account_id, credential_id, public_key, counter FROM passkey_credentials WHERE credential_id = ?'
  ).get(response.id) as {
    id: number
    account_id: number
    credential_id: string
    public_key: string
    counter: number
  } | undefined

  if (!credential) {
    throw createError({ statusCode: 401, statusMessage: '未找到通行密钥' })
  }

  try {
    const verification = await verifyAuthentication(
      response,
      credential.public_key,
      credential.counter,
    )

    if (!verification.verified) {
      throw createError({ statusCode: 401, statusMessage: '验证失败' })
    }

    // Update counter and last_used_at
    db.prepare(
      "UPDATE passkey_credentials SET counter = ?, last_used_at = datetime('now') WHERE id = ?"
    ).run(verification.authenticationInfo.newCounter, credential.id)

    // Get account info and complete login
    const account = db.prepare(
      'SELECT id, name, password_hash FROM accounts WHERE id = ?'
    ).get(credential.account_id) as { id: number; name: string; password_hash: string }

    if (!account) {
      throw createError({ statusCode: 404, statusMessage: '账号不存在' })
    }

    registerAccountKey(account.id, account.password_hash)

    return {
      success: true,
      accountId: account.id,
      accountName: account.name,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 401, statusMessage: err.message || '认证失败' })
  }
})
