import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async () => {
  const db = useDatabase()

  const categories = db.prepare(`
    SELECT sc.*, COUNT(d.id) as domain_count
    FROM show_categories sc
    LEFT JOIN domains d ON d.show_category_id = sc.id AND d.is_public = 1
    GROUP BY sc.id
    ORDER BY sc.sort_order ASC, sc.name ASC
  `).all()

  return {
    success: true,
    data: categories,
  }
})
