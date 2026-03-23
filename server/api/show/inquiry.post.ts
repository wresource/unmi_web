import { defineEventHandler, readBody, createError, setResponseHeader } from 'h3'
import { useDatabase } from '~/server/database'
import { checkInquiryRateLimit } from '~/server/utils/ratelimit'
import { getClientIp } from '~/server/utils/clientip'

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event)
  const rateCheck = checkInquiryRateLimit(clientIp)
  if (!rateCheck.allowed) {
    setResponseHeader(event, 'Retry-After', String(rateCheck.retryAfter))
    throw createError({ statusCode: 429, statusMessage: '提交过于频繁，请稍后再试' })
  }

  const body = await readBody(event)

  if (!body.name || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!body.email || !body.email.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }
  if (!body.domain_name || !body.domain_name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Domain name is required' })
  }

  const db = useDatabase()

  // Look up the domain id if it exists
  const domain = db.prepare('SELECT id FROM domains WHERE domain_name = ? AND is_public = 1').get(body.domain_name.trim().toLowerCase()) as any

  db.prepare(`
    INSERT INTO inquiries (domain_id, domain_name, name, email, phone, wechat, company, budget, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    domain?.id || null,
    body.domain_name.trim().toLowerCase(),
    body.name.trim(),
    body.email.trim(),
    body.phone?.trim() || '',
    body.wechat?.trim() || '',
    body.company?.trim() || '',
    body.budget?.trim() || '',
    body.message?.trim() || '',
  )

  return {
    success: true,
    message: 'Inquiry submitted successfully',
  }
})
