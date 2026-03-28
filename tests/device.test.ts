import { describe, it, expect } from 'vitest'
import { generateSnowflakeId, generateDeviceId, hashFingerprint } from '../server/utils/device'

describe('Snowflake ID Generation', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateSnowflakeId())
    }
    expect(ids.size).toBe(100)
  })

  it('should generate non-empty string IDs', () => {
    const id = generateSnowflakeId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('should generate IDs in base-36 format', () => {
    const id = generateSnowflakeId()
    // Base-36 uses 0-9 and a-z
    expect(id).toMatch(/^[0-9a-z]+$/)
  })

  it('should generate monotonically increasing IDs', () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i++) {
      ids.push(generateSnowflakeId())
    }
    // When converted back to BigInt, they should be increasing
    for (let i = 1; i < ids.length; i++) {
      const prev = BigInt('0x' + parseInt(ids[i - 1], 36).toString(16) || '0')
      const curr = BigInt('0x' + parseInt(ids[i], 36).toString(16) || '0')
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })
})

describe('Device ID Generation', () => {
  it('should generate device ID from fingerprint', () => {
    const id = generateDeviceId('test-fingerprint')
    expect(id).toBeTruthy()
    expect(id).toContain('-')
  })

  it('should include snowflake prefix and fingerprint hash suffix', () => {
    const id = generateDeviceId('my-fingerprint')
    const parts = id.split('-')
    // Should have at least 2 parts: snowflake and fp hash
    expect(parts.length).toBeGreaterThanOrEqual(2)
    // Last part should be 8-char hex from fingerprint hash
    const fpHash = parts[parts.length - 1]
    expect(fpHash).toHaveLength(8)
    expect(fpHash).toMatch(/^[0-9a-f]+$/)
  })

  it('should generate different device IDs each call (due to snowflake)', () => {
    const id1 = generateDeviceId('same-fp')
    const id2 = generateDeviceId('same-fp')
    expect(id1).not.toBe(id2)
  })
})

describe('Fingerprint Hashing', () => {
  it('should hash fingerprints consistently', () => {
    const h1 = hashFingerprint('same-input')
    const h2 = hashFingerprint('same-input')
    expect(h1).toBe(h2)
  })

  it('should produce 64-char hex SHA-256 hash', () => {
    const h = hashFingerprint('test-input')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })

  it('should produce different hashes for different inputs', () => {
    const h1 = hashFingerprint('input-a')
    const h2 = hashFingerprint('input-b')
    expect(h1).not.toBe(h2)
  })

  it('should handle empty string', () => {
    const h = hashFingerprint('')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })

  it('should handle Unicode input', () => {
    const h = hashFingerprint('你好世界')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })
})
