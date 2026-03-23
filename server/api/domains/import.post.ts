import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

function extractTld(domainName: string): string {
  const parts = domainName.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(1).join('.')
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { domains, strategy } = body || {}

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'domains array is required' })
  }

  // strategy: 'skip' (default) | 'overwrite'
  const duplicateStrategy = strategy || 'skip'

  const db = useDatabase()
  const now = new Date().toISOString()

  let imported = 0
  let skipped = 0
  const errors: { domain: string; error: string }[] = []

  const insertStmt = db.prepare(`
    INSERT INTO domains (domain_name, tld, registrar, registration_date, expiry_date, purchase_price, renewal_price, status, dns_servers, auto_renew, is_held, hold_cost, memo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const updateStmt = db.prepare(`
    UPDATE domains SET
      tld = ?, registrar = ?, registration_date = ?, expiry_date = ?,
      purchase_price = ?, renewal_price = ?, status = ?, dns_servers = ?,
      auto_renew = ?, is_held = ?, hold_cost = ?, memo = ?, updated_at = ?
    WHERE domain_name = ?
  `)

  const checkStmt = db.prepare('SELECT id FROM domains WHERE domain_name = ?')

  db.transaction(() => {
    for (const d of domains) {
      try {
        if (!d.domain_name || typeof d.domain_name !== 'string') {
          errors.push({ domain: d.domain_name || 'unknown', error: 'Invalid domain name' })
          continue
        }

        const domainName = d.domain_name.trim().toLowerCase()
        const tld = extractTld(domainName)
        const existing = checkStmt.get(domainName)

        if (existing) {
          if (duplicateStrategy === 'overwrite') {
            updateStmt.run(
              tld,
              d.registrar || '',
              d.registration_date || null,
              d.expiry_date || null,
              d.purchase_price || 0,
              d.renewal_price || 0,
              d.status || 'active',
              d.dns_servers || '',
              d.auto_renew ? 1 : 0,
              d.is_held ? 1 : 0,
              d.hold_cost || 0,
              d.memo || '',
              now,
              domainName
            )
            imported++
          } else {
            skipped++
          }
        } else {
          insertStmt.run(
            domainName,
            tld,
            d.registrar || '',
            d.registration_date || null,
            d.expiry_date || null,
            d.purchase_price || 0,
            d.renewal_price || 0,
            d.status || 'active',
            d.dns_servers || '',
            d.auto_renew ? 1 : 0,
            d.is_held ? 1 : 0,
            d.hold_cost || 0,
            d.memo || '',
            now,
            now
          )
          imported++
        }
      } catch (err: any) {
        errors.push({ domain: d.domain_name || 'unknown', error: err.message })
      }
    }
  })()

  return {
    success: true,
    imported,
    skipped,
    errors,
    total: domains.length,
  }
})
