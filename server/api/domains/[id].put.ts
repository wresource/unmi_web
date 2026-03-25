import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { useDatabase } from '~/server/database'

function extractTld(domainName: string): string {
  const parts = domainName.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(1).join('.')
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid domain ID' })
  }

  const body = await readBody(event)
  const db = useDatabase()

  const existing = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }

  // Check for domain name conflicts if changing name
  if (body.domain_name && body.domain_name !== existing.domain_name) {
    const conflict = db.prepare('SELECT id FROM domains WHERE domain_name = ? AND id != ?').get(body.domain_name.trim().toLowerCase(), id)
    if (conflict) {
      throw createError({ statusCode: 409, statusMessage: 'Domain name already exists' })
    }
  }

  const domainName = body.domain_name ? body.domain_name.trim().toLowerCase() : existing.domain_name
  const tld = extractTld(domainName)
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE domains SET
      domain_name = ?,
      tld = ?,
      registrar = ?,
      registration_date = ?,
      expiry_date = ?,
      purchase_price = ?,
      renewal_price = ?,
      status = ?,
      dns_servers = ?,
      auto_renew = ?,
      is_held = ?,
      hold_cost = ?,
      memo = ?,
      is_public = ?,
      show_price = ?,
      price_type = ?,
      show_description = ?,
      show_category_id = ?,
      is_featured = ?,
      registrant_name = ?,
      registrant_org = ?,
      registrant_email = ?,
      registrant_phone = ?,
      registrant_country = ?,
      registrant_province = ?,
      registrant_city = ?,
      registrant_address = ?,
      admin_name = ?,
      admin_email = ?,
      tech_name = ?,
      tech_email = ?,
      updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    domainName,
    tld,
    body.registrar ?? existing.registrar,
    body.registration_date ?? existing.registration_date,
    body.expiry_date ?? existing.expiry_date,
    body.purchase_price ?? existing.purchase_price,
    body.renewal_price ?? existing.renewal_price,
    body.status ?? existing.status,
    body.dns_servers ?? existing.dns_servers,
    body.auto_renew !== undefined ? (body.auto_renew ? 1 : 0) : existing.auto_renew,
    body.is_held !== undefined ? (body.is_held ? 1 : 0) : existing.is_held,
    body.hold_cost ?? existing.hold_cost,
    body.memo ?? existing.memo,
    body.is_public !== undefined ? (body.is_public ? 1 : 0) : existing.is_public,
    body.show_price ?? existing.show_price,
    body.price_type ?? existing.price_type,
    body.show_description ?? existing.show_description,
    body.show_category_id ?? existing.show_category_id,
    body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured,
    body.registrant_name ?? existing.registrant_name,
    body.registrant_org ?? existing.registrant_org,
    body.registrant_email ?? existing.registrant_email,
    body.registrant_phone ?? existing.registrant_phone,
    body.registrant_country ?? existing.registrant_country,
    body.registrant_province ?? existing.registrant_province,
    body.registrant_city ?? existing.registrant_city,
    body.registrant_address ?? existing.registrant_address,
    body.admin_name ?? existing.admin_name,
    body.admin_email ?? existing.admin_email,
    body.tech_name ?? existing.tech_name,
    body.tech_email ?? existing.tech_email,
    now,
    id
  )

  // Update tags if provided
  if (body.tag_ids && Array.isArray(body.tag_ids)) {
    db.prepare('DELETE FROM domain_tags WHERE domain_id = ?').run(id)
    const tagStmt = db.prepare('INSERT OR IGNORE INTO domain_tags (domain_id, tag_id) VALUES (?, ?)')
    for (const tagId of body.tag_ids) {
      tagStmt.run(id, tagId)
    }
  }

  const updated = db.prepare('SELECT * FROM domains WHERE id = ?').get(id)

  return {
    success: true,
    data: updated,
  }
})
