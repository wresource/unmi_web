import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async () => {
  const db = useDatabase()

  const totalDomains = db.prepare(`
    SELECT COUNT(*) as count FROM domains d
    JOIN accounts a ON a.id = d.account_id
    WHERE d.is_public = 1 AND a.is_public = 1 AND a.name != ''
  `).get() as { count: number }

  const activeCategories = db.prepare(`
    SELECT COUNT(*) as count FROM show_categories WHERE is_active = 1
  `).get() as { count: number }

  const featuredCount = db.prepare(`
    SELECT COUNT(*) as count FROM domains d
    JOIN accounts a ON a.id = d.account_id
    WHERE d.is_featured = 1 AND d.is_public = 1 AND a.is_public = 1 AND a.name != ''
  `).get() as { count: number }

  return {
    success: true,
    data: {
      total_domains: totalDomains.count,
      active_categories: activeCategories.count,
      featured_count: featuredCount.count,
    },
  }
})
