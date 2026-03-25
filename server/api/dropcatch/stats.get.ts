import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(() => {
  const db = useDatabase()

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM drop_domains').get() as { cnt: number }).cnt

  const byStatus = db.prepare('SELECT status, COUNT(*) as cnt FROM drop_domains GROUP BY status').all() as { status: string; cnt: number }[]

  const byTld = db.prepare('SELECT tld, COUNT(*) as cnt FROM drop_domains GROUP BY tld ORDER BY cnt DESC').all() as { tld: string; cnt: number }[]

  const byLength = db.prepare(`
    SELECT
      CASE
        WHEN domain_length <= 3 THEN '1-3'
        WHEN domain_length <= 5 THEN '4-5'
        WHEN domain_length <= 8 THEN '6-8'
        WHEN domain_length <= 12 THEN '9-12'
        ELSE '13+'
      END as range,
      COUNT(*) as cnt
    FROM drop_domains
    GROUP BY range
    ORDER BY MIN(domain_length)
  `).all() as { range: string; cnt: number }[]

  const byPrice = db.prepare(`
    SELECT
      CASE
        WHEN estimated_value < 50 THEN '<$50'
        WHEN estimated_value < 100 THEN '$50-100'
        WHEN estimated_value < 500 THEN '$100-500'
        WHEN estimated_value < 1000 THEN '$500-1K'
        ELSE '$1K+'
      END as range,
      COUNT(*) as cnt
    FROM drop_domains
    GROUP BY range
    ORDER BY MIN(estimated_value)
  `).all() as { range: string; cnt: number }[]

  const distinctTlds = byTld.length

  const pendingDelete = byStatus.find(s => s.status === 'pending_delete')?.cnt || 0
  const expiring = byStatus.find(s => s.status === 'expiring')?.cnt || 0

  return {
    total,
    pendingDelete,
    expiring,
    distinctTlds,
    byStatus,
    byTld,
    byLength,
    byPrice,
  }
})
