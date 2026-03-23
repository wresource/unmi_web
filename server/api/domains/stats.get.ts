import { defineEventHandler, getQuery } from 'h3'
import { useDatabase } from '~/server/database'
import { appraiseDomain } from '~/server/utils/appraisal'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const query = getQuery(event)
  const accountId = getAccountId(event)

  // Parse time range filter
  const timeRange = (query.time_range as string) || '12m'
  const registrar = (query.registrar as string) || ''
  const tld = (query.tld as string) || ''

  // Calculate date range for renewal forecast
  let monthsAhead = 12
  if (timeRange === '3m') monthsAhead = 3
  else if (timeRange === '6m') monthsAhead = 6
  else if (timeRange === '24m') monthsAhead = 24
  else if (timeRange === 'all') monthsAhead = 120 // 10 years

  // Build WHERE conditions for filtered queries
  const conditions: string[] = ['d.account_id = ?']
  const params: any[] = [accountId]

  if (registrar) {
    conditions.push('d.registrar = ?')
    params.push(registrar)
  }
  if (tld) {
    conditions.push('d.tld = ?')
    params.push(tld)
  }

  const baseWhere = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  const andConditions = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''

  // ==========================================
  // Overview stats
  // ==========================================

  // Total domains (filtered)
  const totalRow = db.prepare(
    `SELECT COUNT(*) as v FROM domains d ${baseWhere}`
  ).get(...params) as { v: number }

  // Active domains
  const activeRow = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE (status = 'active' OR (expiry_date IS NOT NULL AND expiry_date > date('now'))) ${andConditions}`
  ).get(...params) as { v: number }

  // Expiring within time range
  const expiringRow = db.prepare(
    `SELECT COUNT(*) as v FROM domains d
     WHERE expiry_date IS NOT NULL AND expiry_date != ''
     AND expiry_date > date('now')
     AND expiry_date <= date('now', '+' || ? || ' months')
     ${andConditions}`
  ).get(monthsAhead, ...params) as { v: number }

  // Expiring buckets
  const exp7 = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE expiry_date > date('now') AND expiry_date <= date('now', '+7 days') ${andConditions}`
  ).get(...params) as { v: number }
  const exp30 = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE expiry_date > date('now') AND expiry_date <= date('now', '+30 days') ${andConditions}`
  ).get(...params) as { v: number }
  const exp90 = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE expiry_date > date('now') AND expiry_date <= date('now', '+90 days') ${andConditions}`
  ).get(...params) as { v: number }
  const exp365 = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE expiry_date > date('now') AND expiry_date <= date('now', '+365 days') ${andConditions}`
  ).get(...params) as { v: number }

  // Expired
  const expiredRow = db.prepare(
    `SELECT COUNT(*) as v FROM domains d WHERE expiry_date IS NOT NULL AND expiry_date != '' AND expiry_date <= date('now') ${andConditions}`
  ).get(...params) as { v: number }

  // Total renewal cost (for domains expiring within time range)
  const renewCostRow = db.prepare(
    `SELECT
       COALESCE(SUM(renewal_price), 0) as totalCost,
       COALESCE(AVG(CASE WHEN renewal_price > 0 THEN renewal_price END), 0) as avgPrice
     FROM domains d
     WHERE expiry_date IS NOT NULL AND expiry_date != ''
     AND expiry_date > date('now')
     AND expiry_date <= date('now', '+' || ? || ' months')
     ${andConditions}`
  ).get(monthsAhead, ...params) as { totalCost: number; avgPrice: number }

  // All domains total renewal cost
  const allCostRow = db.prepare(
    `SELECT COALESCE(SUM(renewal_price), 0) as v FROM domains d ${baseWhere}`
  ).get(...params) as { v: number }

  // ==========================================
  // Monthly renewal forecast (domains expiring each month)
  // ==========================================
  const monthlyTrend = db.prepare(
    `SELECT
       strftime('%Y-%m', expiry_date) as month,
       COUNT(*) as count,
       COALESCE(SUM(renewal_price), 0) as cost
     FROM domains d
     WHERE expiry_date IS NOT NULL AND expiry_date != ''
     AND expiry_date > date('now')
     AND expiry_date <= date('now', '+' || ? || ' months')
     ${andConditions}
     GROUP BY month
     ORDER BY month ASC`
  ).all(monthsAhead, ...params)

  // ==========================================
  // By registrar (with cost)
  // ==========================================
  const registrarCosts = db.prepare(
    `SELECT
       registrar,
       COUNT(*) as count,
       COALESCE(SUM(renewal_price), 0) as cost
     FROM domains d
     WHERE registrar IS NOT NULL AND registrar != ''
     ${andConditions}
     GROUP BY registrar
     ORDER BY cost DESC`
  ).all(...params)

  // ==========================================
  // By TLD (with count)
  // ==========================================
  const tldDistribution = db.prepare(
    `SELECT tld, COUNT(*) as count FROM domains d
     WHERE tld IS NOT NULL AND tld != ''
     ${andConditions}
     GROUP BY tld ORDER BY count DESC`
  ).all(...params)

  // ==========================================
  // Distinct lists for filter dropdowns
  // ==========================================
  const registrars = (db.prepare(
    `SELECT DISTINCT registrar FROM domains WHERE account_id = ? AND registrar IS NOT NULL AND registrar != '' ORDER BY registrar`
  ).all(accountId) as { registrar: string }[]).map(r => r.registrar)

  const tlds = (db.prepare(
    `SELECT DISTINCT tld FROM domains WHERE account_id = ? AND tld IS NOT NULL AND tld != '' ORDER BY tld`
  ).all(accountId) as { tld: string }[]).map(r => r.tld)

  // ==========================================
  // Upcoming renewal domain list (time range)
  // ==========================================
  const upcomingDomains = db.prepare(
    `SELECT d.id, d.domain_name, d.registrar, d.tld, d.expiry_date, d.renewal_price, d.status,
       CAST(julianday(d.expiry_date) - julianday('now') AS INTEGER) as remaining_days
     FROM domains d
     WHERE d.expiry_date IS NOT NULL AND d.expiry_date != ''
     AND d.expiry_date > date('now')
     AND d.expiry_date <= date('now', '+' || ? || ' months')
     ${andConditions}
     ORDER BY d.expiry_date ASC
     LIMIT 100`
  ).all(monthsAhead, ...params)

  // ==========================================
  // Portfolio Valuation (appraise all domains)
  // ==========================================
  const allDomains = db.prepare(
    `SELECT domain_name, registration_date, purchase_price, renewal_price FROM domains d ${baseWhere}`
  ).all(...params) as { domain_name: string; registration_date: string | null; purchase_price: number; renewal_price: number }[]

  let totalAppraisalValue = 0
  let totalPurchaseCost = 0
  let totalAnnualCost = 0
  const domainAppraisals: { domain: string; value: number; valueCNY: number; confidence: string; purchasePrice: number }[] = []

  for (const d of allDomains) {
    const appraisal = appraiseDomain(d.domain_name, d.registration_date)
    totalAppraisalValue += appraisal.estimatedValue
    totalPurchaseCost += d.purchase_price || 0
    totalAnnualCost += d.renewal_price || 0
    domainAppraisals.push({
      domain: d.domain_name,
      value: appraisal.estimatedValue,
      valueCNY: appraisal.estimatedValueCNY,
      confidence: appraisal.confidence,
      purchasePrice: d.purchase_price || 0,
    })
  }

  // Sort by value descending
  domainAppraisals.sort((a, b) => b.value - a.value)

  // ==========================================
  // Renewal records (from renewal_records table)
  // ==========================================
  const renewalRecords = db.prepare(
    `SELECT r.id, r.renewal_date, r.renewal_years, r.renewal_price, r.memo,
       d.domain_name, d.registrar
     FROM renewal_records r
     JOIN domains d ON r.domain_id = d.id
     ORDER BY r.renewal_date DESC
     LIMIT 50`
  ).all()

  return {
    // Overview
    total_domains: totalRow.v,
    active_domains: activeRow.v,
    expiring_soon: expiringRow.v,
    expired: expiredRow.v,
    total_renewal_cost: Math.round(renewCostRow.totalCost * 100) / 100,
    all_renewal_cost: Math.round(allCostRow.v * 100) / 100,
    avg_renewal_price: Math.round(renewCostRow.avgPrice * 100) / 100,

    // Expiry distribution buckets
    expiry_distribution: {
      '7d': exp7.v,
      '30d': exp30.v,
      '90d': exp90.v,
      '365d': exp365.v,
    },

    // Charts data
    monthly_trend: monthlyTrend,
    registrar_costs: registrarCosts,
    tld_distribution: tldDistribution,

    // Filter options
    registrars,
    tlds,

    // Domain lists
    upcoming_domains: upcomingDomains,
    renewal_records: renewalRecords.map((r: any) => ({
      id: r.id,
      domain: r.domain_name,
      registrar: r.registrar,
      date: r.renewal_date,
      years: r.renewal_years,
      cost: r.renewal_price,
      memo: r.memo,
    })),

    // Portfolio valuation
    valuation: {
      totalAppraisalUSD: totalAppraisalValue,
      totalAppraisalCNY: Math.round(totalAppraisalValue * 7.2),
      totalPurchaseCost,
      totalAnnualCost,
      roi: totalPurchaseCost > 0 ? Math.round((totalAppraisalValue - totalPurchaseCost) / totalPurchaseCost * 100) : 0,
      domains: domainAppraisals,
    },

    // Keep old field names for dashboard compatibility
    total: totalRow.v,
    expiring7: exp7.v,
    expiring30: exp30.v,
    expiring90: exp90.v,
    totalRenewalCost: allCostRow.v,
    totalHoldCost: 0,
    avgRenewalPrice: Math.round(renewCostRow.avgPrice * 100) / 100,
    byRegistrar: registrarCosts.map((r: any) => ({ registrar: r.registrar, count: r.count })),
    byTld: tldDistribution,
    byStatus: [],
    monthlyRenewal: monthlyTrend,
  }
})
