import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.domain_id) {
    throw createError({ statusCode: 400, statusMessage: 'domain_id is required' })
  }
  if (!body?.renewal_date) {
    throw createError({ statusCode: 400, statusMessage: 'renewal_date is required' })
  }

  const db = useDatabase()

  // Verify domain exists
  const domain = db.prepare('SELECT id FROM domains WHERE id = ?').get(body.domain_id)
  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  const result = db.prepare(`
    INSERT INTO renewal_records (domain_id, renewal_date, renewal_years, renewal_price, registrar, memo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    body.domain_id,
    body.renewal_date,
    body.renewal_years || 1,
    body.renewal_price || 0,
    body.registrar || '',
    body.memo || ''
  )

  const created = db.prepare('SELECT * FROM renewal_records WHERE id = ?').get(result.lastInsertRowid)

  return {
    success: true,
    data: created,
  }
})
