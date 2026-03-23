import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid renewal record ID' })
  }

  const db = useDatabase()

  const existing = db.prepare('SELECT id FROM renewal_records WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Renewal record not found' })
  }

  db.prepare('DELETE FROM renewal_records WHERE id = ?').run(id)

  return {
    success: true,
    message: 'Renewal record deleted successfully',
  }
})
