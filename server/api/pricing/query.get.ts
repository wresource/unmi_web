import { defineEventHandler, getQuery, createError } from 'h3'
import { queryTldPricing } from '~/server/utils/pricing'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tld = (query.tld as string || '').replace(/^\./, '').trim().toLowerCase()

  if (!tld) {
    throw createError({ statusCode: 400, statusMessage: 'tld parameter is required' })
  }

  const result = await queryTldPricing(tld)
  return result
})
