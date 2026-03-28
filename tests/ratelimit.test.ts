import { describe, it, expect } from 'vitest'
import { checkRateLimit, checkWhoisRateLimit, checkInquiryRateLimit } from '../server/utils/ratelimit'

describe('Rate Limiting', () => {
  it('should allow requests within limit', () => {
    const key = `test-allow-${Date.now()}`
    const r = checkRateLimit(key, 5, 1)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
    expect(r.retryAfter).toBe(0)
  })

  it('should decrement remaining tokens', () => {
    const key = `test-decrement-${Date.now()}`
    checkRateLimit(key, 5, 0.001)
    const r = checkRateLimit(key, 5, 0.001)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(3)
  })

  it('should deny requests over limit', () => {
    const key = `test-burst-${Date.now()}`
    // Exhaust all tokens
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 0.001) // very slow refill
    }
    const r = checkRateLimit(key, 3, 0.001)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfter).toBeGreaterThan(0)
  })

  it('should refill tokens over time', async () => {
    const key = `test-refill-${Date.now()}`
    // Use all tokens
    for (let i = 0; i < 2; i++) {
      checkRateLimit(key, 2, 100) // fast refill: 100/sec
    }
    // Wait briefly for refill
    await new Promise(r => setTimeout(r, 50))
    const r = checkRateLimit(key, 2, 100)
    expect(r.allowed).toBe(true)
  })

  it('should not exceed maxTokens on refill', async () => {
    const key = `test-cap-${Date.now()}`
    checkRateLimit(key, 3, 1000) // use 1 token
    await new Promise(r => setTimeout(r, 50))
    const r = checkRateLimit(key, 3, 1000)
    // remaining should not exceed maxTokens - 1
    expect(r.remaining).toBeLessThanOrEqual(2)
  })

  it('should create separate buckets for different keys', () => {
    const keyA = `test-a-${Date.now()}`
    const keyB = `test-b-${Date.now()}`
    // Exhaust key A
    for (let i = 0; i < 2; i++) {
      checkRateLimit(keyA, 2, 0.001)
    }
    const rA = checkRateLimit(keyA, 2, 0.001)
    const rB = checkRateLimit(keyB, 2, 0.001)
    expect(rA.allowed).toBe(false)
    expect(rB.allowed).toBe(true)
  })
})

describe('WHOIS Rate Limiting', () => {
  it('should allow initial WHOIS queries', () => {
    const ip = `192.168.1.${Math.floor(Math.random() * 255)}`
    const r = checkWhoisRateLimit(ip)
    expect(r.allowed).toBe(true)
    expect(r.retryAfter).toBe(0)
  })

  it('should include reason when denied', () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 255)}`
    // Exhaust the per-IP limit (10 tokens)
    for (let i = 0; i < 10; i++) {
      checkWhoisRateLimit(ip)
    }
    const r = checkWhoisRateLimit(ip)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBeTruthy()
  })
})

describe('Inquiry Rate Limiting', () => {
  it('should allow initial inquiry requests', () => {
    const ip = `172.16.0.${Math.floor(Math.random() * 255)}`
    const r = checkInquiryRateLimit(ip)
    expect(r.allowed).toBe(true)
  })

  it('should deny after burst limit', () => {
    const ip = `172.16.1.${Math.floor(Math.random() * 255)}`
    for (let i = 0; i < 3; i++) {
      checkInquiryRateLimit(ip)
    }
    const r = checkInquiryRateLimit(ip)
    expect(r.allowed).toBe(false)
    expect(r.retryAfter).toBeGreaterThan(0)
  })
})
