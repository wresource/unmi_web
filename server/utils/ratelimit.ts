// ============================================================================
// Rate Limiter - Token bucket per key (IP or global)
// ============================================================================

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

// Cleanup old buckets every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 600_000) {
      buckets.delete(key)
    }
  }
}, 300_000)

/**
 * Check if a request is allowed under rate limiting.
 * Uses a token bucket algorithm.
 *
 * @param key - unique key (e.g., IP address or "global")
 * @param maxTokens - max tokens in the bucket
 * @param refillRate - tokens added per second
 * @returns { allowed, remaining, retryAfter }
 */
export function checkRateLimit(
  key: string,
  maxTokens: number,
  refillRate: number,
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now }
    buckets.set(key, bucket)
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate)
  bucket.lastRefill = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 }
  }

  // Calculate when the next token will be available
  const retryAfter = Math.ceil((1 - bucket.tokens) / refillRate)
  return { allowed: false, remaining: 0, retryAfter }
}

// ============================================================================
// Global WHOIS query rate limiter
// Limits: 1 query per 3 seconds per IP, max 10 burst
// Global: 5 queries per second max (to protect server IP)
// ============================================================================

export function checkWhoisRateLimit(clientIp: string): { allowed: boolean; retryAfter: number; reason?: string } {
  // Per-IP limit: 10 tokens, refill 1 per 3 seconds (max ~20/min per IP)
  const ipResult = checkRateLimit(`whois:ip:${clientIp}`, 10, 0.33)
  if (!ipResult.allowed) {
    return { allowed: false, retryAfter: ipResult.retryAfter, reason: '查询过于频繁，请稍后再试' }
  }

  // Global limit: 20 tokens, refill 2 per second (max ~120/min total)
  const globalResult = checkRateLimit('whois:global', 20, 2)
  if (!globalResult.allowed) {
    return { allowed: false, retryAfter: globalResult.retryAfter, reason: '系统繁忙，请稍后再试' }
  }

  return { allowed: true, retryAfter: 0 }
}

// ============================================================================
// Inquiry rate limiter
// Limits: 3 per minute per IP
// ============================================================================

export function checkInquiryRateLimit(clientIp: string): { allowed: boolean; retryAfter: number } {
  const result = checkRateLimit(`inquiry:ip:${clientIp}`, 3, 0.05) // 3 burst, ~3/min
  return { allowed: result.allowed, retryAfter: result.retryAfter }
}
