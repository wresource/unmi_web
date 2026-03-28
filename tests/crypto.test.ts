import { describe, it, expect } from 'vitest'
import { deriveKey, encrypt, decrypt, generateDeviceSalt, isEncrypted, encryptDomainFields, decryptDomainFields } from '../server/utils/crypto'

describe('Crypto', () => {
  const salt = generateDeviceSalt()
  const key = deriveKey('test-password-hash', salt)

  it('should generate a 64-char hex device salt', () => {
    expect(salt).toHaveLength(64)
    expect(salt).toMatch(/^[0-9a-f]+$/)
  })

  it('should generate unique salts each time', () => {
    const salt2 = generateDeviceSalt()
    expect(salt2).not.toBe(salt)
  })

  it('should derive a 32-byte key', () => {
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })

  it('should derive the same key for same inputs (cached)', () => {
    const key2 = deriveKey('test-password-hash', salt)
    expect(key2).toBe(key) // same reference due to caching
  })

  it('should derive different keys for different passwords', () => {
    const key2 = deriveKey('different-password', salt)
    expect(key2.equals(key)).toBe(false)
  })

  it('should derive different keys for different salts', () => {
    const salt2 = generateDeviceSalt()
    const key2 = deriveKey('test-password-hash', salt2)
    expect(key2.equals(key)).toBe(false)
  })

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'Hello, World!'
    const ciphertext = encrypt(plaintext, key)
    expect(ciphertext).not.toBe(plaintext)
    expect(ciphertext.length).toBeGreaterThan(0)
    const decrypted = decrypt(ciphertext, key)
    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt and decrypt Unicode text', () => {
    const plaintext = 'Hello, World! 你好世界 🌍'
    const ciphertext = encrypt(plaintext, key)
    const decrypted = decrypt(ciphertext, key)
    expect(decrypted).toBe(plaintext)
  })

  it('should return empty for empty input', () => {
    expect(encrypt('', key)).toBe('')
    expect(decrypt('', key)).toBe('')
  })

  it('should fail decryption with wrong key', () => {
    const ciphertext = encrypt('secret data', key)
    const wrongKey = deriveKey('wrong-password', salt)
    const result = decrypt(ciphertext, wrongKey)
    expect(result).toBe('')
  })

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const a = encrypt('same text', key)
    const b = encrypt('same text', key)
    expect(a).not.toBe(b)
  })

  it('should detect encrypted data', () => {
    const ciphertext = encrypt('test data here', key)
    expect(isEncrypted(ciphertext)).toBe(true)
  })

  it('should reject plain text as not encrypted', () => {
    expect(isEncrypted('plain text')).toBe(false)
    expect(isEncrypted('')).toBe(false)
    expect(isEncrypted('short')).toBe(false)
  })

  it('should handle corrupted ciphertext gracefully', () => {
    const result = decrypt('notvalidbase64!!!', key)
    expect(result).toBe('')
  })

  it('should encrypt and decrypt domain fields', () => {
    const fields = {
      domain_name: 'example.com',
      registrar: 'GoDaddy',
      dns_servers: 'ns1.example.com',
      memo: 'Important domain',
    }
    const encrypted = encryptDomainFields(fields, key)
    expect(encrypted.domain_name).not.toBe(fields.domain_name)
    expect(encrypted.registrar).not.toBe(fields.registrar)

    const decrypted = decryptDomainFields(encrypted, key)
    expect(decrypted).toEqual(fields)
  })

  it('should handle empty domain fields', () => {
    const fields = {
      domain_name: '',
      registrar: '',
      dns_servers: '',
      memo: '',
    }
    const encrypted = encryptDomainFields(fields, key)
    expect(encrypted.domain_name).toBe('')
    const decrypted = decryptDomainFields(encrypted, key)
    expect(decrypted).toEqual(fields)
  })
})
