import { TOTP, Secret } from 'otpauth'
import { randomBytes } from 'crypto'

const ISSUER = 'UnMi Domain Manager'

export function generateTOTPSecret(accountName: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountName || 'account',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return {
    secret: secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTOTP(secretBase32: string, token: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(5)
    let code = ''
    for (const b of bytes) code += chars[b % chars.length]
    // Format: XXXX-XXXX
    codes.push(code.substring(0, 4) + '-' + code.substring(4, 8).padEnd(4, chars[0]))
  }
  return codes
}

export function verifyBackupCode(storedCodesJson: string, code: string): { valid: boolean; remainingCodes: string[] } {
  try {
    const codes: string[] = JSON.parse(storedCodesJson)
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const idx = codes.findIndex(c => c.replace(/[^A-Z0-9]/g, '') === normalized)
    if (idx === -1) return { valid: false, remainingCodes: codes }
    codes.splice(idx, 1)
    return { valid: true, remainingCodes: codes }
  } catch {
    return { valid: false, remainingCodes: [] }
  }
}
