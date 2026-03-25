import { defineEventHandler, createError, readBody } from 'h3'
import { getAccountId } from '~/server/utils/account'
import { fetchDropDomains, markRefreshed, updateAuctionPrices } from '~/server/utils/dropcatch'
import { isDropCatchConfigured } from '~/server/utils/dropcatch-api'

export default defineEventHandler(async (event) => {
  const accountId = getAccountId(event)
  if (!accountId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const dropcatchApi = isDropCatchConfigured()
  if (!dropcatchApi) {
    throw createError({ statusCode: 400, statusMessage: 'DropCatch API not configured' })
  }

  // Read optional parameters from request body
  const body = await readBody(event).catch(() => ({})) || {}
  const tlds = Array.isArray(body.tlds) ? body.tlds as string[] : ['.com', '.net', '.org']
  const maxPerTld = typeof body.maxPerTld === 'number' ? Math.min(body.maxPerTld, 2000) : 2000

  // Fetch domains from DropCatch API
  const imported = await fetchDropDomains({
    tlds,
    maxPerTld,
  })

  // Mark as refreshed after manual trigger
  markRefreshed()

  // Update prices for any non-dropcatch domains that may exist
  let priced = 0
  try {
    priced = await updateAuctionPrices()
  } catch (err) {
    console.warn('[dropcatch] Price update failed:', (err as Error).message)
  }

  return { imported, priced, dropcatchApi }
})
