import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Account ID required' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  // Accounts with empty name cannot be set to public
  if (body.is_public && (!account.name || account.name.trim() === '')) {
    throw createError({ statusCode: 400, statusMessage: 'Account name must be set before enabling public visibility' })
  }

  db.prepare(`
    UPDATE accounts SET
      is_public = ?,
      contact_email = ?,
      contact_wechat = ?
    WHERE id = ?
  `).run(
    body.is_public !== undefined ? (body.is_public ? 1 : 0) : (account.is_public || 0),
    body.contact_email ?? account.contact_email ?? '',
    body.contact_wechat ?? account.contact_wechat ?? '',
    accountId,
  )

  const updated = db.prepare('SELECT id, name, is_public, contact_email, contact_wechat FROM accounts WHERE id = ?').get(accountId)

  return {
    success: true,
    data: updated,
  }
})
