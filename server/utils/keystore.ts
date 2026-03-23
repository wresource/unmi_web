import { deriveKey, encrypt, decrypt, generateDeviceSalt } from './crypto'
import { useDatabase } from '~/server/database'

// In-memory key store: accountId -> derived encryption key
const accountKeys = new Map<number, Buffer>()

/**
 * Get or create the device salt (stored in settings table)
 */
export function getDeviceSalt(): string {
  const db = useDatabase()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'device_salt'").get() as { value: string } | undefined

  if (row?.value) return row.value

  const salt = generateDeviceSalt()
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('device_salt', ?, datetime('now'))").run(salt)
  return salt
}

/**
 * Register an account's encryption key after successful authentication.
 * Called during login/unlock.
 */
export function registerAccountKey(accountId: number, passwordHash: string): void {
  const salt = getDeviceSalt()
  const key = deriveKey(passwordHash, salt)
  accountKeys.set(accountId, key)
}

/**
 * Get the encryption key for an account.
 * Returns null if the account hasn't been authenticated in this session.
 */
export function getAccountKey(accountId: number): Buffer | null {
  return accountKeys.get(accountId) || null
}

/**
 * Remove an account's key (on logout/lock)
 */
export function removeAccountKey(accountId: number): void {
  accountKeys.delete(accountId)
}

/**
 * Encrypt sensitive data for storage.
 * Fields encrypted: purchase_price, renewal_price, hold_cost, memo
 * These are private business data that should not be readable without auth.
 */
export function encryptSensitiveData(
  accountId: number,
  data: { purchase_price?: number; renewal_price?: number; hold_cost?: number; memo?: string },
): string {
  const key = getAccountKey(accountId)
  if (!key) return '' // Not authenticated, store empty

  const payload = JSON.stringify({
    pp: data.purchase_price ?? 0,
    rp: data.renewal_price ?? 0,
    hc: data.hold_cost ?? 0,
    m: data.memo ?? '',
  })

  return encrypt(payload, key)
}

/**
 * Decrypt sensitive data from storage.
 * Returns defaults if decryption fails (wrong key or not authenticated).
 */
export function decryptSensitiveData(
  accountId: number,
  encryptedData: string,
): { purchase_price: number; renewal_price: number; hold_cost: number; memo: string } {
  const defaults = { purchase_price: 0, renewal_price: 0, hold_cost: 0, memo: '' }

  if (!encryptedData) return defaults

  const key = getAccountKey(accountId)
  if (!key) return defaults

  try {
    const json = decrypt(encryptedData, key)
    if (!json) return defaults

    const parsed = JSON.parse(json)
    return {
      purchase_price: parsed.pp ?? 0,
      renewal_price: parsed.rp ?? 0,
      hold_cost: parsed.hc ?? 0,
      memo: parsed.m ?? '',
    }
  } catch {
    return defaults
  }
}
