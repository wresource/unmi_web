import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid domain ID' })
  }

  const db = useDatabase()

  const existing = db.prepare('SELECT id FROM domains WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  db.transaction(() => {
    db.prepare('DELETE FROM domain_tags WHERE domain_id = ?').run(id)
    db.prepare('DELETE FROM renewal_records WHERE domain_id = ?').run(id)
    db.prepare('DELETE FROM domains WHERE id = ?').run(id)
  })()

  return {
    success: true,
    message: 'Domain deleted successfully',
  }
})
