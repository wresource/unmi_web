import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { computeDeviceIdFromJwk } from '~/server/utils/device-crypto'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  const body = await readBody(event)
  const { publicKeyJwk, deviceName } = body || {}

  if (!publicKeyJwk || !publicKeyJwk.kty) {
    throw createError({ statusCode: 400, statusMessage: 'Public key is required' })
  }

  const deviceId = computeDeviceIdFromJwk(publicKeyJwk)
  const db = useDatabase()

  // Check device count (max 10)
  const count = db.prepare('SELECT COUNT(*) as cnt FROM device_auth WHERE account_id = ?').get(accountId) as { cnt: number }
  if (count.cnt >= 10) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum 10 devices allowed' })
  }

  const userAgent = getHeader(event, 'user-agent') || ''

  // Store device with public key
  db.prepare(`
    INSERT INTO device_auth (account_id, device_id, device_name, device_fingerprint, user_agent, last_used_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id, device_id) DO UPDATE SET
      device_name = excluded.device_name,
      device_fingerprint = excluded.device_fingerprint,
      user_agent = excluded.user_agent,
      last_used_at = datetime('now')
  `).run(accountId, deviceId, deviceName || '', JSON.stringify(publicKeyJwk), userAgent)

  db.prepare('UPDATE accounts SET device_auth_enabled = 1 WHERE id = ?').run(accountId)

  return { success: true, deviceId }
})
