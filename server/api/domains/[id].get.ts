import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid domain ID' })
  }

  const db = useDatabase()

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  // Get tags
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    INNER JOIN domain_tags dt ON t.id = dt.tag_id
    WHERE dt.domain_id = ?
  `).all(id)

  // Get renewal records
  const renewalRecords = db.prepare(`
    SELECT * FROM renewal_records WHERE domain_id = ? ORDER BY renewal_date DESC
  `).all(id)

  // Calculate remaining days
  let remainingDays: number | null = null
  if (domain.expiry_date) {
    const expiry = new Date(domain.expiry_date)
    const now = new Date()
    remainingDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    data: {
      ...domain,
      remainingDays,
      tags,
      renewalRecords,
    },
  }
})
