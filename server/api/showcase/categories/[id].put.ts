import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category ID' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  const existing = db.prepare('SELECT * FROM show_categories WHERE id = ?').get(id) as any
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  // Check slug uniqueness if changing
  if (body.slug && body.slug !== existing.slug) {
    const conflict = db.prepare('SELECT id FROM show_categories WHERE slug = ? AND id != ?').get(body.slug, id)
    if (conflict) {
      throw createError({ statusCode: 409, statusMessage: 'Category slug already exists' })
    }
  }

  db.prepare(`
    UPDATE show_categories SET
      name = ?,
      slug = ?,
      description = ?,
      icon = ?,
      sort_order = ?,
      is_active = ?
    WHERE id = ?
  `).run(
    body.name?.trim() ?? existing.name,
    body.slug?.trim() ?? existing.slug,
    body.description?.trim() ?? existing.description,
    body.icon?.trim() ?? existing.icon,
    body.sort_order ?? existing.sort_order,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
    id,
  )

  const updated = db.prepare('SELECT * FROM show_categories WHERE id = ?').get(id)

  return {
    success: true,
    data: updated,
  }
})
