import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { ids } = body || {}

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'ids array is required and must not be empty' })
  }

  const db = useDatabase()
  const placeholders = ids.map(() => '?').join(',')

  const deleted = db.transaction(() => {
    db.prepare(`DELETE FROM domain_tags WHERE domain_id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM renewal_records WHERE domain_id IN (${placeholders})`).run(...ids)
    const result = db.prepare(`DELETE FROM domains WHERE id IN (${placeholders})`).run(...ids)
    return result.changes
  })()

  return {
    success: true,
    deleted,
    message: `${deleted} domain(s) deleted successfully`,
  }
})
