import { describe, it, expect } from 'vitest'
import { generateDeviceChallenge, consumeChallenge, computeDeviceIdFromJwk } from '../server/utils/device-crypto'

describe('Device Crypto', () => {
  describe('Challenge generation and consumption', () => {
    it('should generate a challenge string', () => {
      const challenge = generateDeviceChallenge('device-1')
      expect(challenge).toBeTruthy()
      expect(challenge.length).toBeGreaterThan(20)
    })

    it('should generate different challenges each time', () => {
      const c1 = generateDeviceChallenge('device-2a')
      const c2 = generateDeviceChallenge('device-2b')
      expect(c1).not.toBe(c2)
    })

    it('should consume a challenge (one-time use)', () => {
      const deviceId = `test-consume-${Date.now()}`
      generateDeviceChallenge(deviceId)
      const c1 = consumeChallenge(deviceId)
      expect(c1).toBeTruthy()
      const c2 = consumeChallenge(deviceId)
      expect(c2).toBeNull()
    })

    it('should return null for non-existent device', () => {
      const result = consumeChallenge('non-existent-device-id')
      expect(result).toBeNull()
    })

    it('should overwrite previous challenge for same device', () => {
      const deviceId = `test-overwrite-${Date.now()}`
      const first = generateDeviceChallenge(deviceId)
      const second = generateDeviceChallenge(deviceId)
      expect(first).not.toBe(second)
      const consumed = consumeChallenge(deviceId)
      expect(consumed).toBe(second)
    })
  })

  describe('Device ID from JWK', () => {
    it('should compute device ID from JWK', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'testX', y: 'testY' }
      const id = computeDeviceIdFromJwk(jwk)
      expect(id).toBeTruthy()
      expect(id.length).toBe(16)
    })

    it('should return consistent IDs for same JWK', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'consistentX', y: 'consistentY' }
      const id1 = computeDeviceIdFromJwk(jwk)
      const id2 = computeDeviceIdFromJwk(jwk)
      expect(id1).toBe(id2)
    })

    it('should produce different IDs for different JWKs', () => {
      const id1 = computeDeviceIdFromJwk({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' })
      const id2 = computeDeviceIdFromJwk({ kty: 'EC', crv: 'P-256', x: 'c', y: 'd' })
      expect(id1).not.toBe(id2)
    })

    it('should use base64url encoding', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'test', y: 'key' }
      const id = computeDeviceIdFromJwk(jwk)
      // base64url should not contain +, /, or =
      expect(id).not.toMatch(/[+/=]/)
    })
  })
})
