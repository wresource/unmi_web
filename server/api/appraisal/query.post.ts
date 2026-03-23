import { defineEventHandler, readBody, createError } from 'h3'
import { appraiseDomain } from '~/server/utils/appraisal'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const domain = body?.domain?.trim()?.toLowerCase()
  const registrationDate = body?.registration_date || null

  if (!domain) {
    throw createError({ statusCode: 400, statusMessage: 'domain is required' })
  }

  return appraiseDomain(domain, registrationDate)
})
