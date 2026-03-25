import { createHash, randomBytes } from 'crypto'
import { createPublicKey, verify } from 'crypto'

// Challenge store (in-memory, expires after 2 minutes)
const challenges = new Map<string, { challenge: string; expires: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of challenges) {
    if (now > val.expires) challenges.delete(key)
  }
}, 60000)

/**
 * Generate a random challenge for device verification.
 */
export function generateDeviceChallenge(deviceId: string): string {
  const challenge = randomBytes(32).toString('base64url')
  challenges.set(deviceId, { challenge, expires: Date.now() + 120000 }) // 2 min
  return challenge
}

/**
 * Get and consume a challenge (one-time use).
 */
export function consumeChallenge(deviceId: string): string | null {
  const entry = challenges.get(deviceId)
  if (!entry || Date.now() > entry.expires) {
    challenges.delete(deviceId)
    return null
  }
  challenges.delete(deviceId)
  return entry.challenge
}

/**
 * Verify an ECDSA P-256 signature against a JWK public key.
 * Used to prove that the request comes from the device that holds the private key.
 */
export function verifyDeviceSignature(
  publicKeyJwk: any,
  challengeBase64url: string,
  signatureBase64url: string,
): boolean {
  try {
    // Convert JWK to Node.js key object
    const keyObject = createPublicKey({
      key: publicKeyJwk,
      format: 'jwk',
    })

    // Convert base64url to Buffers
    const challengeBuf = Buffer.from(challengeBase64url, 'base64url')
    const signatureBuf = Buffer.from(signatureBase64url, 'base64url')

    // ECDSA signatures from Web Crypto are in IEEE P1363 format (r || s)
    // Node.js crypto expects DER format, so we need to convert
    const derSignature = p1363ToDer(signatureBuf)

    return verify(
      'SHA256',
      challengeBuf,
      keyObject,
      derSignature
    )
  } catch (e) {
    console.warn('[device-crypto] Verification failed:', e)
    return false
  }
}

/**
 * Convert IEEE P1363 signature format (used by Web Crypto) to DER format (used by Node.js).
 */
function p1363ToDer(sig: Buffer): Buffer {
  const half = sig.length / 2
  let r = sig.subarray(0, half)
  let s = sig.subarray(half)

  // Remove leading zeros but keep one if high bit is set
  while (r.length > 1 && r[0] === 0 && r[1] < 128) r = r.subarray(1)
  while (s.length > 1 && s[0] === 0 && s[1] < 128) s = s.subarray(1)

  // Add leading zero if high bit is set (to keep positive in DER)
  if (r[0] >= 128) r = Buffer.concat([Buffer.from([0]), r])
  if (s[0] >= 128) s = Buffer.concat([Buffer.from([0]), s])

  const rLen = r.length
  const sLen = s.length
  const totalLen = 2 + rLen + 2 + sLen

  return Buffer.concat([
    Buffer.from([0x30, totalLen, 0x02, rLen]),
    r,
    Buffer.from([0x02, sLen]),
    s,
  ])
}

/**
 * Compute device ID from public key JWK (same as client-side).
 */
export function computeDeviceIdFromJwk(publicKeyJwk: any): string {
  const keyStr = JSON.stringify(publicKeyJwk)
  const hash = createHash('sha256').update(keyStr).digest()
  return hash.toString('base64url').substring(0, 16)
}
