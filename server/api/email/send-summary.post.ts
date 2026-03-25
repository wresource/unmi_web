import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'
import { sendEmail, buildSummaryEmailHtml } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)

  const today = new Date().toISOString().split('T')[0]

  // Get domain stats
  const totalDomains = (db.prepare(
    'SELECT COUNT(*) as cnt FROM domains WHERE account_id = ?'
  ).get(accountId) as { cnt: number })?.cnt || 0

  const expiring7 = (db.prepare(
    "SELECT COUNT(*) as cnt FROM domains WHERE account_id = ? AND expiry_date IS NOT NULL AND expiry_date >= ? AND julianday(expiry_date) - julianday(?) <= 7"
  ).get(accountId, today, today) as { cnt: number })?.cnt || 0

  const expiring30 = (db.prepare(
    "SELECT COUNT(*) as cnt FROM domains WHERE account_id = ? AND expiry_date IS NOT NULL AND expiry_date >= ? AND julianday(expiry_date) - julianday(?) <= 30"
  ).get(accountId, today, today) as { cnt: number })?.cnt || 0

  const expired = (db.prepare(
    "SELECT COUNT(*) as cnt FROM domains WHERE account_id = ? AND expiry_date IS NOT NULL AND expiry_date < ?"
  ).get(accountId, today) as { cnt: number })?.cnt || 0

  const totalRenewalCost = (db.prepare(
    "SELECT COALESCE(SUM(renewal_price), 0) as total FROM domains WHERE account_id = ? AND expiry_date IS NOT NULL AND expiry_date >= ? AND julianday(expiry_date) - julianday(?) <= 365"
  ).get(accountId, today, today) as { total: number })?.total || 0

  const topExpiring = db.prepare(
    "SELECT domain_name, expiry_date, CAST(julianday(expiry_date) - julianday(?) AS INTEGER) as remaining_days FROM domains WHERE account_id = ? AND expiry_date IS NOT NULL AND expiry_date >= ? AND julianday(expiry_date) - julianday(?) <= 30 ORDER BY expiry_date ASC LIMIT 10"
  ).all(today, accountId, today, today) as { domain_name: string; expiry_date: string; remaining_days: number }[]

  const html = buildSummaryEmailHtml({
    totalDomains,
    expiring7,
    expiring30,
    expired,
    totalRenewalCost: Math.round(totalRenewalCost),
    topExpiring,
  })

  const result = await sendEmail(accountId, 'Domain Manager - Portfolio Summary', html)

  return result
})
