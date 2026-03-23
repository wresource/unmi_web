import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tag ID' })
  }

  const db = useDatabase()

  const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
  }

  db.transaction(() => {
    db.prepare('DELETE FROM domain_tags WHERE tag_id = ?').run(id)
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  })()

  return {
    success: true,
    message: 'Tag deleted successfully',
  }
})
