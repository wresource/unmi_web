import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const accountId = getAccountId(event)
  let generated = 0

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Get all domains for this account
  const domains = db.prepare(`
    SELECT id, domain_name, expiry_date, renewal_price
    FROM domains
    WHERE account_id = ?
  `).all(accountId) as { id: number; domain_name: string; expiry_date: string; renewal_price: number }[]

  const insertNotification = db.prepare(`
    INSERT INTO notifications (account_id, type, title, message, domain_id, domain_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  // Check for duplicate within 24 hours
  const hasDuplicate = db.prepare(`
    SELECT COUNT(*) as cnt FROM notifications
    WHERE account_id = ? AND type = ? AND domain_id = ?
      AND created_at >= datetime('now', '-24 hours')
  `)

  let expiringCount = 0
  let totalRenewalCost = 0

  for (const domain of domains) {
    if (!domain.expiry_date) continue

    const expiryDate = new Date(domain.expiry_date)
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let type = ''
    let title = ''
    let message = ''

    if (diffDays < 0) {
      type = 'expired'
      title = `域名 ${domain.domain_name} 已过期`
      message = `该域名已于 ${domain.expiry_date.split('T')[0]} 过期，已过期 ${Math.abs(diffDays)} 天。`
    } else if (diffDays <= 7) {
      type = 'expiry_urgent'
      title = `域名 ${domain.domain_name} 即将到期`
      message = `该域名将在 ${diffDays} 天内到期 (${domain.expiry_date.split('T')[0]})，请尽快续费。`
      expiringCount++
      totalRenewalCost += domain.renewal_price || 0
    } else if (diffDays <= 30) {
      type = 'expiry_warning'
      title = `域名 ${domain.domain_name} 即将到期`
      message = `该域名将在 ${diffDays} 天后到期 (${domain.expiry_date.split('T')[0]})。`
      expiringCount++
      totalRenewalCost += domain.renewal_price || 0
    }

    if (type) {
      const dup = hasDuplicate.get(accountId, type, domain.id) as { cnt: number }
      if (dup.cnt === 0) {
        insertNotification.run(accountId, type, title, message, domain.id, domain.domain_name)
        generated++
      }
    }
  }

  // Generate daily summary (check for duplicate)
  const summaryDup = db.prepare(`
    SELECT COUNT(*) as cnt FROM notifications
    WHERE account_id = ? AND type = 'daily_summary'
      AND created_at >= datetime('now', '-24 hours')
  `).get(accountId) as { cnt: number }

  if (summaryDup.cnt === 0) {
    const summaryTitle = '每日资产总结'
    const summaryMessage = `您当前共有 ${domains.length} 个域名，其中 ${expiringCount} 个即将到期，预计续费总额 ¥${totalRenewalCost.toFixed(2)}。`
    insertNotification.run(accountId, 'daily_summary', summaryTitle, summaryMessage, null, '')
    generated++
  }

  return { generated }
})
