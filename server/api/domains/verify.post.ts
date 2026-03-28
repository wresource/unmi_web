import { defineEventHandler, readBody, createError } from 'h3'
import { promises as dns } from 'dns'
import { randomBytes } from 'crypto'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  // Get the account's verify token
  const account = db.prepare('SELECT verify_token FROM accounts WHERE id = ?').get(accountId) as { verify_token: string } | undefined
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  let verifyToken = account.verify_token
  if (!verifyToken) {
    verifyToken = `unmi-verify=${randomBytes(16).toString('hex')}`
    db.prepare("UPDATE accounts SET verify_token = ? WHERE id = ?").run(verifyToken, accountId)
  }

  // Get domain by id or name
  let domain: any = null
  if (body.domainId) {
    domain = db.prepare('SELECT id, domain_name FROM domains WHERE id = ? AND account_id = ?')
      .get(body.domainId, accountId)
  } else if (body.domainName) {
    domain = db.prepare('SELECT id, domain_name FROM domains WHERE domain_name = ? AND account_id = ?')
      .get(body.domainName, accountId)
  }

  if (!domain) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  // DNS TXT lookup
  const host = `_unmi-verify.${domain.domain_name}`
  try {
    const records = await dns.resolveTxt(host)
    // records is an array of arrays of strings
    const allRecords = records.flat()
    const verified = allRecords.some((r: string) => r.trim() === verifyToken.trim())

    if (verified) {
      db.prepare("UPDATE domains SET is_verified = 1, verified_at = datetime('now') WHERE id = ?")
        .run(domain.id)
      return { verified: true, domain: domain.domain_name }
    } else {
      return {
        verified: false,
        domain: domain.domain_name,
        expected: verifyToken,
        found: allRecords,
        host,
      }
    }
  } catch (err: any) {
    return {
      verified: false,
      domain: domain.domain_name,
      error: 'DNS lookup failed - TXT record not found',
      host,
      expected: verifyToken,
    }
  }
})
