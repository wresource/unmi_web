import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category ID' })
  }

  const db = useDatabase()

  const existing = db.prepare('SELECT * FROM show_categories WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  // Reset domains that reference this category
  db.prepare('UPDATE domains SET show_category_id = 0 WHERE show_category_id = ?').run(id)

  db.prepare('DELETE FROM show_categories WHERE id = ?').run(id)

  return {
    success: true,
    message: 'Category deleted',
  }
})
