import { defineEventHandler, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { appraiseDomain } from '~/server/utils/appraisal'

export default defineEventHandler(async (event) => {
  const name = event.context.params?.name
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Domain name is required' })
  }

  const db = useDatabase()
  const domain = db.prepare('SELECT * FROM drop_domains WHERE domain_name = ?').get(name) as any

  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  // Run appraisal
  let appraisal = null
  try {
    appraisal = appraiseDomain(domain.domain_name)
  } catch { /* ignore appraisal errors */ }

  // Calculate days until drop
  let daysUntilDrop: number | null = null
  if (domain.drop_date) {
    const dropDate = new Date(domain.drop_date)
    const now = new Date()
    daysUntilDrop = Math.ceil((dropDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    ...domain,
    days_until_drop: daysUntilDrop,
    appraisal,
  }
})
