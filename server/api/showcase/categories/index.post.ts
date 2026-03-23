import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || `cat-${Date.now()}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Category name is required' })
  }

  const db = useDatabase()
  const slug = body.slug?.trim() || generateSlug(body.name)

  const existing = db.prepare('SELECT id FROM show_categories WHERE slug = ?').get(slug)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Category slug already exists' })
  }

  const result = db.prepare(`
    INSERT INTO show_categories (name, slug, description, icon, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    body.name.trim(),
    slug,
    body.description?.trim() || '',
    body.icon?.trim() || '',
    body.sort_order ?? 0,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
  )

  const created = db.prepare('SELECT * FROM show_categories WHERE id = ?').get(result.lastInsertRowid)

  return {
    success: true,
    data: created,
  }
})
