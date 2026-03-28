import { describe, it, expect } from 'vitest'
import { generateTOTPSecret, verifyTOTP, generateBackupCodes, verifyBackupCode } from '../server/utils/totp'
import { TOTP, Secret } from 'otpauth'

describe('TOTP', () => {
  it('should generate a secret with URI', () => {
    const { secret, uri } = generateTOTPSecret('testuser')
    expect(secret).toBeTruthy()
    expect(secret.length).toBeGreaterThan(10)
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('testuser')
    expect(uri).toContain('UnMi')
  })

  it('should generate different secrets each time', () => {
    const a = generateTOTPSecret('user1')
    const b = generateTOTPSecret('user2')
    expect(a.secret).not.toBe(b.secret)
  })

  it('should verify a valid TOTP code', () => {
    const { secret } = generateTOTPSecret('testuser')
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    })
    const token = totp.generate()
    expect(verifyTOTP(secret, token)).toBe(true)
  })

  it('should reject an invalid TOTP code', () => {
    const { secret } = generateTOTPSecret('testuser')
    expect(verifyTOTP(secret, '000000')).toBe(false)
    expect(verifyTOTP(secret, 'abcdef')).toBe(false)
    expect(verifyTOTP(secret, '')).toBe(false)
  })

  it('should use default account name when empty', () => {
    const { uri } = generateTOTPSecret('')
    expect(uri).toContain('account')
  })
})

describe('Backup Codes', () => {
  it('should generate the requested number of codes', () => {
    const codes = generateBackupCodes(10)
    expect(codes).toHaveLength(10)
  })

  it('should generate codes in XXXX-XXXX format', () => {
    const codes = generateBackupCodes(5)
    codes.forEach(code => {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    })
  })

  it('should generate unique codes', () => {
    const codes = generateBackupCodes(10)
    expect(new Set(codes).size).toBe(10)
  })

  it('should verify and consume a backup code', () => {
    const codes = generateBackupCodes(5)
    const codesJson = JSON.stringify(codes)
    const result = verifyBackupCode(codesJson, codes[2])
    expect(result.valid).toBe(true)
    expect(result.remainingCodes).toHaveLength(4)
    expect(result.remainingCodes).not.toContain(codes[2])
  })

  it('should reject an invalid backup code', () => {
    const codes = generateBackupCodes(5)
    const result = verifyBackupCode(JSON.stringify(codes), 'ZZZZ-ZZZZ')
    expect(result.valid).toBe(false)
    expect(result.remainingCodes).toHaveLength(5)
  })

  it('should not consume the same code twice', () => {
    const codes = generateBackupCodes(5)
    const first = verifyBackupCode(JSON.stringify(codes), codes[0])
    expect(first.valid).toBe(true)
    const second = verifyBackupCode(JSON.stringify(first.remainingCodes), codes[0])
    expect(second.valid).toBe(false)
  })

  it('should handle malformed JSON gracefully', () => {
    const result = verifyBackupCode('not-json', 'AAAA-BBBB')
    expect(result.valid).toBe(false)
    expect(result.remainingCodes).toEqual([])
  })

  it('should normalize code format for comparison', () => {
    const codes = generateBackupCodes(3)
    // Verify with lowercase version (without hyphen)
    const rawCode = codes[0].replace('-', '')
    const result = verifyBackupCode(JSON.stringify(codes), rawCode.toLowerCase())
    expect(result.valid).toBe(true)
  })
})
