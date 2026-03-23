import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(() => {
  const db = useDatabase()

  const tags = db.prepare(`
    SELECT t.*, COUNT(dt.domain_id) as domain_count
    FROM tags t
    LEFT JOIN domain_tags dt ON t.id = dt.tag_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all()

  return {
    data: tags,
  }
})
