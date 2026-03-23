import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, color } = body || {}

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Tag name is required' })
  }

  const db = useDatabase()

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim())
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Tag already exists' })
  }

  const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(
    name.trim(),
    color || '#3B82F6'
  )

  const created = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid)

  return {
    success: true,
    data: created,
  }
})
