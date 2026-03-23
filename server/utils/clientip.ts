import { type H3Event, getHeader, getRequestIP } from 'h3'

/**
 * Get the real client IP address from the request.
 * Checks common proxy headers in order of trust.
 * For Nginx reverse proxy, X-Real-IP is most reliable.
 */
export function getClientIp(event: H3Event): string {
  // 1. X-Real-IP (set by Nginx proxy_set_header)
  const xRealIp = getHeader(event, 'x-real-ip')
  if (xRealIp) return xRealIp.trim()

  // 2. X-Forwarded-For (first IP is the client)
  const xff = getHeader(event, 'x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  // 3. CF-Connecting-IP (if behind Cloudflare)
  const cfIp = getHeader(event, 'cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  // 4. Fallback to h3's built-in
  const reqIp = getRequestIP(event, { xForwardedFor: true })
  return reqIp || '127.0.0.1'
}
