import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { appraiseDomain } from '~/server/utils/appraisal'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Domain name is required' })
  }

  const db = useDatabase()

  const domain = db.prepare(`
    SELECT
      d.domain_name, d.tld, d.show_price, d.price_type, d.show_description,
      d.is_featured, d.view_count, d.show_category_id, d.status,
      d.registration_date, d.id as domain_id,
      sc.name as category_name
    FROM domains d
    JOIN accounts a ON a.id = d.account_id
    LEFT JOIN show_categories sc ON sc.id = d.show_category_id
    WHERE d.domain_name = ? AND d.is_public = 1 AND d.is_verified = 1 AND a.is_public = 1 AND a.name != ''
  `).get(name.toLowerCase()) as any

  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  // Increment view count
  db.prepare('UPDATE domains SET view_count = view_count + 1 WHERE domain_name = ?').run(name.toLowerCase())

  // Track daily view stats
  const today = new Date().toISOString().split('T')[0]
  db.prepare(`
    INSERT INTO domain_views (domain_id, view_date, view_count)
    VALUES (?, ?, 1)
    ON CONFLICT(domain_id, view_date) DO UPDATE SET view_count = view_count + 1
  `).run(domain.domain_id, today)

  // Get tags
  const tags = db.prepare(`
    SELECT t.name FROM domain_tags dt
    JOIN tags t ON t.id = dt.tag_id
    WHERE dt.domain_id = ?
  `).all(domain.domain_id) as { name: string }[]

  // Get related domains (same category or TLD, limit 6)
  const related = db.prepare(`
    SELECT
      d.domain_name, d.tld, d.show_price, d.price_type, d.show_description,
      d.is_featured, d.view_count, d.show_category_id
    FROM domains d
    JOIN accounts a ON a.id = d.account_id
    WHERE d.is_public = 1 AND d.is_verified = 1 AND a.is_public = 1 AND a.name != ''
      AND d.domain_name != ?
      AND (d.show_category_id = ? OR d.tld = ?)
    ORDER BY d.is_featured DESC, d.view_count DESC
    LIMIT 6
  `).all(name.toLowerCase(), domain.show_category_id, domain.tld) as any[]

  // Appraisal
  const appraisal = appraiseDomain(domain.domain_name, domain.registration_date)

  // Remove internal fields
  const { domain_id, registration_date, ...publicDomain } = domain

  return {
    success: true,
    data: {
      ...publicDomain,
      view_count: (publicDomain.view_count || 0) + 1,
      tags: tags.map(t => t.name),
      appraisal,
      related,
    },
  }
})
