import { defineEventHandler, createError } from 'h3'
import { randomBytes } from 'crypto'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDatabase()
  const account = db.prepare('SELECT verify_token FROM accounts WHERE id = ?').get(accountId) as { verify_token: string } | undefined

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  let token = account.verify_token
  if (!token) {
    token = `unmi-verify=${randomBytes(16).toString('hex')}`
    db.prepare("UPDATE accounts SET verify_token = ? WHERE id = ?").run(token, accountId)
  }

  return {
    success: true,
    token,
    instructions: {
      recordType: 'TXT',
      recordHost: '_unmi-verify.{domain}',
      recordValue: token,
      description: 'Add a TXT record at _unmi-verify.{your-domain} with the token value to verify domain ownership.',
    },
  }
})
