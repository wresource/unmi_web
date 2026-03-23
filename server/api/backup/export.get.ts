import { defineEventHandler, setResponseHeader } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler((event) => {
  const db = useDatabase()

  const domains = db.prepare('SELECT * FROM domains ORDER BY id').all()
  const tags = db.prepare('SELECT * FROM tags ORDER BY id').all()
  const domainTags = db.prepare('SELECT * FROM domain_tags').all()
  const renewalRecords = db.prepare('SELECT * FROM renewal_records ORDER BY id').all()
  const settings = db.prepare("SELECT * FROM settings WHERE key NOT IN ('password_hash', 'device_key')").all()
  const whoisLogs = db.prepare('SELECT * FROM whois_query_logs ORDER BY id').all()

  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      domains,
      tags,
      domainTags,
      renewalRecords,
      settings,
      whoisLogs,
    },
  }

  const totalRecords = domains.length + tags.length + renewalRecords.length

  // Log the export
  try {
    db.prepare(`
      INSERT INTO sync_backup_logs (type, status, file_name, record_count, details, created_at)
      VALUES ('export', 'success', ?, ?, 'Full backup export', datetime('now'))
    `).run(`backup-${new Date().toISOString().slice(0, 10)}.json`, totalRecords)
  } catch (_) {
    // Non-critical, don't fail the export
  }

  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`)

  return backup
})
