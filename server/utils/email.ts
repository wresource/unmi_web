import nodemailer from 'nodemailer'
import { useDatabase } from '~/server/database'
import { getAccountId } from '~/server/utils/account'

// Known SMTP servers by email domain suffix
const SMTP_SERVERS: Record<string, { host: string; port: number; secure: boolean }> = {
  // Chinese providers
  'qq.com': { host: 'smtp.qq.com', port: 465, secure: true },
  'foxmail.com': { host: 'smtp.qq.com', port: 465, secure: true },
  '163.com': { host: 'smtp.163.com', port: 465, secure: true },
  '126.com': { host: 'smtp.126.com', port: 465, secure: true },
  'yeah.net': { host: 'smtp.yeah.net', port: 465, secure: true },
  'sina.com': { host: 'smtp.sina.com', port: 465, secure: true },
  'sina.cn': { host: 'smtp.sina.com', port: 465, secure: true },
  'sohu.com': { host: 'smtp.sohu.com', port: 465, secure: true },
  'aliyun.com': { host: 'smtp.aliyun.com', port: 465, secure: true },
  '139.com': { host: 'smtp.139.com', port: 465, secure: true },
  '189.cn': { host: 'smtp.189.cn', port: 465, secure: true },
  'wo.cn': { host: 'smtp.wo.cn', port: 465, secure: true },

  // International providers
  'gmail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'googlemail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  'live.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  'yahoo.co.jp': { host: 'smtp.mail.yahoo.co.jp', port: 465, secure: true },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'me.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'mac.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'zoho.com': { host: 'smtp.zoho.com', port: 465, secure: true },
  'yandex.com': { host: 'smtp.yandex.com', port: 465, secure: true },
  'yandex.ru': { host: 'smtp.yandex.ru', port: 465, secure: true },
  'mail.ru': { host: 'smtp.mail.ru', port: 465, secure: true },
  'fastmail.com': { host: 'smtp.fastmail.com', port: 465, secure: true },
  'protonmail.com': { host: 'smtp.protonmail.ch', port: 465, secure: true },
  'aol.com': { host: 'smtp.aol.com', port: 465, secure: true },
  'gmx.com': { host: 'mail.gmx.com', port: 465, secure: true },
  'gmx.net': { host: 'mail.gmx.net', port: 465, secure: true },
}

// Try to discover SMTP for custom domains via DNS MX records
const MX_TO_SMTP: Record<string, { host: string; port: number; secure: boolean }> = {
  'google': { host: 'smtp.gmail.com', port: 465, secure: true },
  'outlook': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  'qq.com': { host: 'smtp.qq.com', port: 465, secure: true },
  'mxhichina': { host: 'smtp.mxhichina.com', port: 465, secure: true }, // Aliyun enterprise
  'ym.163.com': { host: 'smtp.ym.163.com', port: 465, secure: true }, // 163 enterprise
  'exmail.qq.com': { host: 'smtp.exmail.qq.com', port: 465, secure: true }, // Tencent enterprise
}

/**
 * Get SMTP config for an email domain.
 * Returns known config or null.
 */
export function getSmtpConfig(emailDomain: string): { host: string; port: number; secure: boolean } | null {
  const lower = emailDomain.toLowerCase()
  return SMTP_SERVERS[lower] || null
}

/**
 * Try to discover SMTP via DNS MX lookup for unknown domains.
 */
export async function discoverSmtp(domain: string): Promise<{ host: string; port: number; secure: boolean } | null> {
  // First check known list
  const known = getSmtpConfig(domain)
  if (known) return known

  // Try DNS MX lookup
  try {
    const { promises: dns } = await import('dns')
    const mxRecords = await dns.resolveMx(domain)
    if (mxRecords?.length) {
      const mxHost = mxRecords[0].exchange.toLowerCase()
      for (const [pattern, config] of Object.entries(MX_TO_SMTP)) {
        if (mxHost.includes(pattern)) return config
      }
      // Fallback: try smtp.{domain} with common ports
      return { host: `smtp.${domain}`, port: 465, secure: true }
    }
  } catch {}

  return null
}

/**
 * Get all known email suffixes for the frontend dropdown.
 */
export function getKnownEmailSuffixes(): { domain: string; label: string }[] {
  return [
    { domain: 'qq.com', label: 'QQ 邮箱' },
    { domain: 'foxmail.com', label: 'Foxmail' },
    { domain: '163.com', label: '网易 163' },
    { domain: '126.com', label: '网易 126' },
    { domain: 'sina.com', label: '新浪邮箱' },
    { domain: 'aliyun.com', label: '阿里云邮箱' },
    { domain: 'gmail.com', label: 'Gmail' },
    { domain: 'outlook.com', label: 'Outlook' },
    { domain: 'hotmail.com', label: 'Hotmail' },
    { domain: 'yahoo.com', label: 'Yahoo' },
    { domain: 'icloud.com', label: 'iCloud' },
    { domain: 'zoho.com', label: 'Zoho' },
    { domain: 'yandex.com', label: 'Yandex' },
    { domain: 'mail.ru', label: 'Mail.ru' },
    { domain: 'fastmail.com', label: 'FastMail' },
    { domain: 'protonmail.com', label: 'ProtonMail' },
  ]
}

/**
 * Send an email using stored SMTP configuration for an account.
 */
export async function sendEmail(
  accountId: number,
  subject: string,
  htmlContent: string,
): Promise<{ success: boolean; error?: string }> {
  const db = useDatabase()

  // Get email settings
  const settings = db.prepare(
    "SELECT setting_key, setting_value FROM notification_settings WHERE account_id = ?"
  ).all(accountId) as { setting_key: string; setting_value: string }[]

  const settingsMap = new Map(settings.map(s => [s.setting_key, s.setting_value]))

  const smtpHost = settingsMap.get('smtp_host') || ''
  const smtpPort = parseInt(settingsMap.get('smtp_port') || '465')
  const smtpSecure = settingsMap.get('smtp_secure') !== 'false'
  const smtpUser = settingsMap.get('smtp_user') || ''
  const smtpPass = settingsMap.get('smtp_pass') || ''
  const recipientEmail = settingsMap.get('recipient_email') || ''

  if (!smtpHost || !smtpUser || !smtpPass || !recipientEmail) {
    return { success: false, error: 'Email not configured' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: `"Domain Manager" <${smtpUser}>`,
      to: recipientEmail,
      subject,
      html: htmlContent,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Send failed' }
  }
}

/**
 * Build HTML for domain expiry notification email.
 */
export function buildExpiryEmailHtml(domains: { domain_name: string; expiry_date: string; remaining_days: number; renewal_price: number }[]): string {
  const rows = domains.map(d => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500">${d.domain_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${d.expiry_date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${d.remaining_days <= 7 ? '#dc2626' : d.remaining_days <= 30 ? '#ea580c' : '#16a34a'}">${d.remaining_days} days</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">¥${d.renewal_price || 0}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;padding:24px;margin-bottom:20px">
        <h1 style="color:white;margin:0;font-size:20px">Domain Manager</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Domain Expiry Alert</p>
      </div>
      <p style="color:#374151;font-size:14px">The following domains require your attention:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Domain</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Expiry</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Days Left</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Renewal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by UNMI.IO Domain Manager</p>
    </div>
  `
}

/**
 * Build HTML for daily/weekly/monthly summary email.
 */
export function buildSummaryEmailHtml(summary: {
  totalDomains: number
  expiring7: number
  expiring30: number
  expired: number
  totalRenewalCost: number
  topExpiring: { domain_name: string; expiry_date: string; remaining_days: number }[]
}): string {
  const expiringRows = summary.topExpiring.map(d => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${d.domain_name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${d.expiry_date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${d.remaining_days <= 7 ? '#dc2626' : '#ea580c'}">${d.remaining_days} days</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;padding:24px;margin-bottom:20px">
        <h1 style="color:white;margin:0;font-size:20px">Domain Manager</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Portfolio Summary</p>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:20px">
        <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#1d4ed8">${summary.totalDomains}</div>
          <div style="font-size:12px;color:#6b7280">Total Domains</div>
        </div>
        <div style="flex:1;background:#fef3c7;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#d97706">${summary.expiring30}</div>
          <div style="font-size:12px;color:#6b7280">Expiring (30d)</div>
        </div>
        <div style="flex:1;background:#fee2e2;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#dc2626">${summary.expired}</div>
          <div style="font-size:12px;color:#6b7280">Expired</div>
        </div>
      </div>
      ${summary.topExpiring.length ? `
        <h3 style="color:#374151;font-size:14px;margin-bottom:8px">Upcoming Expirations</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
          <thead><tr style="background:#f9fafb">
            <th style="padding:6px 12px;text-align:left;color:#6b7280">Domain</th>
            <th style="padding:6px 12px;text-align:left;color:#6b7280">Expiry</th>
            <th style="padding:6px 12px;text-align:left;color:#6b7280">Days Left</th>
          </tr></thead>
          <tbody>${expiringRows}</tbody>
        </table>
      ` : ''}
      <p style="color:#374151;font-size:13px">Total renewal cost: <strong>¥${summary.totalRenewalCost}</strong></p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by UNMI.IO Domain Manager</p>
    </div>
  `
}
