import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async () => {
  const db = useDatabase()

  const domains = db.prepare(`
    SELECT
      d.domain_name, d.tld, d.show_price, d.price_type, d.show_description,
      d.is_featured, d.view_count, d.show_category_id, d.status,
      sc.name as category_name
    FROM domains d
    JOIN accounts a ON a.id = d.account_id
    LEFT JOIN show_categories sc ON sc.id = d.show_category_id
    WHERE d.is_featured = 1 AND d.is_public = 1 AND a.is_public = 1 AND a.name != ''
    ORDER BY d.view_count DESC
    LIMIT 12
  `).all()

  return {
    success: true,
    data: domains,
  }
})
