import { type H3Event, getHeader, getQuery } from 'h3'

/**
 * Get the current account ID from the request.
 * Checks x-account-id header first, then query param.
 */
export function getAccountId(event: H3Event): number {
  const fromHeader = getHeader(event, 'x-account-id')
  if (fromHeader) return parseInt(fromHeader) || 0

  const query = getQuery(event)
  if (query.accountId) return parseInt(query.accountId as string) || 0

  return 0
}
