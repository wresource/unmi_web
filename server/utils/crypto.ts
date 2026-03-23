import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// ============================================================================
// AES-256-GCM Encryption for domain data
//
// Each account has a unique encryption key derived from:
//   scrypt(account_password_hash + device_salt)
//
// The device_salt is generated once and stored in settings.
// This means:
//   1. Without the password, data cannot be decrypted
//   2. Without the device_salt, data cannot be decrypted
//   3. Even with the .db file, data is unreadable
// ============================================================================

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Cache derived keys per account to avoid re-deriving on every request
const keyCache = new Map<string, Buffer>()

/**
 * Derive an encryption key from password hash + salt using scrypt
 */
export function deriveKey(passwordHash: string, salt: string): Buffer {
  const cacheKey = `${passwordHash}:${salt}`
  const cached = keyCache.get(cacheKey)
  if (cached) return cached

  const key = scryptSync(passwordHash, salt, KEY_LENGTH)
  keyCache.set(cacheKey, key)
  return key
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (!plaintext) return ''

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  // Pack: iv(16) + tag(16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a base64-encoded encrypted string
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  if (!ciphertext) return ''

  try {
    const packed = Buffer.from(ciphertext, 'base64')

    if (packed.length < IV_LENGTH + TAG_LENGTH) return ''

    const iv = packed.subarray(0, IV_LENGTH)
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = packed.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    // Decryption failed - wrong key or corrupted data
    return ''
  }
}

/**
 * Encrypt sensitive domain fields
 */
export function encryptDomainFields(
  fields: { domain_name: string; registrar: string; dns_servers: string; memo: string },
  key: Buffer,
): { domain_name: string; registrar: string; dns_servers: string; memo: string } {
  return {
    domain_name: encrypt(fields.domain_name, key),
    registrar: encrypt(fields.registrar, key),
    dns_servers: encrypt(fields.dns_servers, key),
    memo: encrypt(fields.memo, key),
  }
}

/**
 * Decrypt sensitive domain fields
 */
export function decryptDomainFields(
  fields: { domain_name: string; registrar: string; dns_servers: string; memo: string },
  key: Buffer,
): { domain_name: string; registrar: string; dns_servers: string; memo: string } {
  return {
    domain_name: decrypt(fields.domain_name, key),
    registrar: decrypt(fields.registrar, key),
    dns_servers: decrypt(fields.dns_servers, key),
    memo: decrypt(fields.memo, key),
  }
}

/**
 * Check if a string looks like encrypted data (base64 encoded, minimum length)
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 44) return false // min: 16+16 bytes = 32 bytes = 44 base64 chars
  try {
    const buf = Buffer.from(value, 'base64')
    return buf.length >= IV_LENGTH + TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Generate a random device salt (stored in settings table)
 */
export function generateDeviceSalt(): string {
  return randomBytes(32).toString('hex')
}
