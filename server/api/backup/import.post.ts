import { defineEventHandler, readBody, createError } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid backup format: missing data field' })
  }

  const { domains, tags, domainTags, renewalRecords, settings } = body.data
  const db = useDatabase()

  let importedCount = 0
  const errors: string[] = []

  try {
    db.transaction(() => {
      // Import tags
      if (tags && Array.isArray(tags)) {
        const tagStmt = db.prepare(`
          INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)
        `)
        for (const t of tags) {
          try {
            tagStmt.run(t.id, t.name, t.color || '#3B82F6', t.created_at || new Date().toISOString())
            importedCount++
          } catch (e: any) {
            errors.push(`Tag "${t.name}": ${e.message}`)
          }
        }
      }

      // Import domains
      if (domains && Array.isArray(domains)) {
        const domainStmt = db.prepare(`
          INSERT OR IGNORE INTO domains (id, domain_name, tld, registrar, registration_date, expiry_date, purchase_price, renewal_price, status, dns_servers, auto_renew, is_held, hold_cost, memo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const d of domains) {
          try {
            domainStmt.run(
              d.id, d.domain_name, d.tld || '', d.registrar || '',
              d.registration_date, d.expiry_date,
              d.purchase_price || 0, d.renewal_price || 0,
              d.status || 'active', d.dns_servers || '',
              d.auto_renew ? 1 : 0, d.is_held ? 1 : 0,
              d.hold_cost || 0, d.memo || '',
              d.created_at || new Date().toISOString(),
              d.updated_at || new Date().toISOString()
            )
            importedCount++
          } catch (e: any) {
            errors.push(`Domain "${d.domain_name}": ${e.message}`)
          }
        }
      }

      // Import domain_tags
      if (domainTags && Array.isArray(domainTags)) {
        const dtStmt = db.prepare('INSERT OR IGNORE INTO domain_tags (domain_id, tag_id) VALUES (?, ?)')
        for (const dt of domainTags) {
          try {
            dtStmt.run(dt.domain_id, dt.tag_id)
          } catch (_) {
            // Skip invalid references silently
          }
        }
      }

      // Import renewal records
      if (renewalRecords && Array.isArray(renewalRecords)) {
        const rrStmt = db.prepare(`
          INSERT OR IGNORE INTO renewal_records (id, domain_id, renewal_date, renewal_years, renewal_price, registrar, memo, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const r of renewalRecords) {
          try {
            rrStmt.run(
              r.id, r.domain_id, r.renewal_date,
              r.renewal_years || 1, r.renewal_price || 0,
              r.registrar || '', r.memo || '',
              r.created_at || new Date().toISOString()
            )
            importedCount++
          } catch (e: any) {
            errors.push(`Renewal record #${r.id}: ${e.message}`)
          }
        }
      }

      // Import settings (non-sensitive)
      if (settings && Array.isArray(settings)) {
        const settingsStmt = db.prepare(`
          INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `)
        const protectedKeys = ['password_hash', 'device_key']
        for (const s of settings) {
          if (!protectedKeys.includes(s.key)) {
            try {
              settingsStmt.run(s.key, s.value)
            } catch (_) {
              // Skip
            }
          }
        }
      }
    })()

    // Log the import
    db.prepare(`
      INSERT INTO sync_backup_logs (type, status, record_count, details, created_at)
      VALUES ('import', 'success', ?, ?, datetime('now'))
    `).run(importedCount, errors.length > 0 ? `Errors: ${errors.join('; ')}` : 'Clean import')

    return {
      success: true,
      imported: importedCount,
      errors,
    }
  } catch (err: any) {
    // Log failed import
    db.prepare(`
      INSERT INTO sync_backup_logs (type, status, details, created_at)
      VALUES ('import', 'failed', ?, datetime('now'))
    `).run(err.message)

    throw createError({ statusCode: 500, statusMessage: `Import failed: ${err.message}` })
  }
})
