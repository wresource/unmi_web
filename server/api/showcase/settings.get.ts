import { defineEventHandler, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Account ID required' })
  }

  const db = useDatabase()
  const account = db.prepare(
    'SELECT id, name, is_public, contact_email, contact_wechat FROM accounts WHERE id = ?'
  ).get(accountId)

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  return {
    success: true,
    data: account,
  }
})
