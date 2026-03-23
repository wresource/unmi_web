import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid inquiry ID' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  // Verify the inquiry belongs to a domain owned by the current account
  const inquiry = db.prepare(`
    SELECT i.* FROM inquiries i
    LEFT JOIN domains d ON d.id = i.domain_id
    WHERE i.id = ? AND d.account_id = ?
  `).get(id, accountId) as any

  if (!inquiry) {
    throw createError({ statusCode: 404, statusMessage: 'Inquiry not found' })
  }

  const validStatuses = ['pending', 'contacted', 'closed', 'invalid']
  if (body.status && !validStatuses.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status value' })
  }

  db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(
    body.status ?? inquiry.status,
    id,
  )

  const updated = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)

  return {
    success: true,
    data: updated,
  }
})
