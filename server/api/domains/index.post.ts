import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'
import { encryptSensitiveData } from '~/server/utils/keystore'

function extractTld(domainName: string): string {
  const parts = domainName.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(1).join('.')
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.domain_name || typeof body.domain_name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'domain_name is required' })
  }

  const domainName = body.domain_name.trim().toLowerCase()
  const tld = extractTld(domainName)
  const now = new Date().toISOString()
  const accountId = getAccountId(event)

  const db = useDatabase()

  // Check duplicate within same account
  const existing = db.prepare('SELECT id FROM domains WHERE domain_name = ? AND account_id = ?').get(domainName, accountId)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Domain already exists' })
  }

  // Encrypt sensitive financial data
  const encryptedData = encryptSensitiveData(accountId, {
    purchase_price: body.purchase_price || 0,
    renewal_price: body.renewal_price || 0,
    hold_cost: body.hold_cost || 0,
    memo: body.memo || '',
  })

  const stmt = db.prepare(`
    INSERT INTO domains (account_id, domain_name, tld, registrar, registration_date, expiry_date, purchase_price, renewal_price, status, dns_servers, auto_renew, is_held, hold_cost, memo, encrypted_data, registrant_name, registrant_org, registrant_email, registrant_phone, registrant_country, registrant_province, registrant_city, registrant_address, admin_name, admin_email, tech_name, tech_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    accountId,
    domainName,
    tld,
    body.registrar || '',
    body.registration_date || null,
    body.expiry_date || null,
    body.purchase_price || 0,
    body.renewal_price || 0,
    body.status || 'active',
    body.dns_servers || '',
    body.auto_renew ? 1 : 0,
    body.is_held ? 1 : 0,
    body.hold_cost || 0,
    body.memo || '',
    encryptedData,
    body.registrant_name || '',
    body.registrant_org || '',
    body.registrant_email || '',
    body.registrant_phone || '',
    body.registrant_country || '',
    body.registrant_province || '',
    body.registrant_city || '',
    body.registrant_address || '',
    body.admin_name || '',
    body.admin_email || '',
    body.tech_name || '',
    body.tech_email || '',
    now,
    now
  )

  // Handle tags if provided
  if (body.tag_ids && Array.isArray(body.tag_ids) && body.tag_ids.length > 0) {
    const tagStmt = db.prepare('INSERT OR IGNORE INTO domain_tags (domain_id, tag_id) VALUES (?, ?)')
    for (const tagId of body.tag_ids) {
      tagStmt.run(result.lastInsertRowid, tagId)
    }
  }

  const created = db.prepare('SELECT * FROM domains WHERE id = ?').get(result.lastInsertRowid)

  return {
    success: true,
    data: created,
  }
})
