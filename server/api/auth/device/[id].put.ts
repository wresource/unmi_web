import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const accountId = Number(getHeader(event, 'x-account-id'))
  if (!accountId) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  const id = Number(event.context.params?.id)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid device ID' })

  const body = await readBody(event)
  const { deviceName } = body || {}

  if (typeof deviceName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'deviceName is required' })
  }

  const db = useDatabase()

  const result = db.prepare(
    'UPDATE device_auth SET device_name = ? WHERE id = ? AND account_id = ?'
  ).run(deviceName.trim(), id, accountId)

  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  }

  return { success: true }
})
