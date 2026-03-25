import { defineEventHandler, readBody, createError } from 'h3'
import nodemailer from 'nodemailer'
import { getClientIp } from '~/server/utils/clientip'

// Simple rate limiting: 1 test per minute per IP
const testRateMap = new Map<string, number>()

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)
  const now = Date.now()
  const lastTest = testRateMap.get(ip) || 0

  if (now - lastTest < 60000) {
    const waitSec = Math.ceil((60000 - (now - lastTest)) / 1000)
    throw createError({ statusCode: 429, message: `Rate limited. Try again in ${waitSec}s` })
  }

  const body = await readBody(event)
  const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, recipient_email } = body || {}

  if (!smtp_host || !smtp_user || !smtp_pass || !recipient_email) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  testRateMap.set(ip, now)

  // Clean old entries every 100 requests
  if (testRateMap.size > 1000) {
    for (const [k, v] of testRateMap) {
      if (now - v > 120000) testRateMap.delete(k)
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 465,
      secure: smtp_secure !== false && smtp_secure !== 'false',
      auth: { user: smtp_user, pass: smtp_pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })

    await transporter.sendMail({
      from: `"Domain Manager" <${smtp_user}>`,
      to: recipient_email,
      subject: 'Domain Manager - Test Email',
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;padding:24px;margin-bottom:20px">
            <h1 style="color:white;margin:0;font-size:20px">Domain Manager</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Test Email</p>
          </div>
          <p style="color:#374151;font-size:14px">This is a test email from your Domain Manager system.</p>
          <p style="color:#374151;font-size:14px">If you received this email, your SMTP configuration is working correctly.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by UNMI.IO Domain Manager</p>
        </div>
      `,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Send failed' }
  }
})
