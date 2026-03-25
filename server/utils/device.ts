import { createHash, randomBytes } from 'crypto'

// Snowflake-like ID generator
let sequence = 0
let lastTimestamp = 0

export function generateSnowflakeId(): string {
  let timestamp = Date.now()
  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1) & 0xFFF
    if (sequence === 0) timestamp++
  } else {
    sequence = 0
  }
  lastTimestamp = timestamp
  const id = BigInt(timestamp - 1609459200000) << 12n | BigInt(sequence)
  return id.toString(36)
}

export function generateDeviceId(fingerprint: string): string {
  const snowflake = generateSnowflakeId()
  const fpHash = createHash('sha256').update(fingerprint).digest('hex').substring(0, 8)
  return `${snowflake}-${fpHash}`
}

export function hashFingerprint(fingerprint: string): string {
  return createHash('sha256').update(fingerprint).digest('hex')
}
