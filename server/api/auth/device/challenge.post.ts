import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { generateDeviceChallenge } from '~/server/utils/device-crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { deviceId } = body || {}

  if (!deviceId) throw createError({ statusCode: 400, statusMessage: 'deviceId required' })

  // Check if this device exists
  const db = useDatabase()
  const device = db.prepare('SELECT id FROM device_auth WHERE device_id = ?').get(deviceId)
  if (!device) {
    return { found: false }
  }

  const challenge = generateDeviceChallenge(deviceId)
  return { found: true, challenge }
})
