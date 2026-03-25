import { defineEventHandler, createError } from 'h3'
import { getAccountId } from '~/server/utils/account'
import { generateSampleDropDomains, importDropDomains } from '~/server/utils/dropcatch'

export default defineEventHandler((event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const domains = generateSampleDropDomains()
  const imported = importDropDomains(domains)

  return { imported }
})
