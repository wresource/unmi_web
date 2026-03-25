import { defineEventHandler, readBody, createError } from 'h3'
import { discoverSmtp } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const domain = body?.domain?.trim()

  if (!domain) {
    throw createError({ statusCode: 400, message: 'Domain is required' })
  }

  const config = await discoverSmtp(domain)

  if (!config) {
    return { success: false, error: 'SMTP not found' }
  }

  return { success: true, data: config }
})
