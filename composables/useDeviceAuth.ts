/**
 * Device authentication composable.
 * Generates a unique device ID using a snowflake-like algorithm on the client side.
 * Works in any browser environment (desktop, mobile, tablet).
 * The ID is persistent in localStorage — once generated, it never changes for that device.
 */
export function useDeviceAuth() {
  /**
   * Generate a snowflake-like unique device ID.
   * Combines: timestamp + random bits + environment fingerprint hash.
   * This works in any JavaScript environment (browser, webview, etc.)
   */
  function generateDeviceId(): string {
    const timestamp = Date.now() - 1609459200000 // epoch: 2021-01-01
    const randomBits = Math.floor(Math.random() * 0xFFFF)

    // Build a short fingerprint from available environment info
    const envParts: string[] = []
    if (typeof navigator !== 'undefined') {
      envParts.push(navigator.userAgent || '')
      envParts.push(navigator.language || '')
      envParts.push(navigator.platform || '')
    }
    if (typeof screen !== 'undefined') {
      envParts.push(`${screen.width}x${screen.height}`)
      envParts.push(`${screen.colorDepth}`)
    }
    try {
      envParts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
    } catch {}
    // Simple hash of environment string
    const envStr = envParts.join('|')
    let hash = 0
    for (let i = 0; i < envStr.length; i++) {
      hash = ((hash << 5) - hash + envStr.charCodeAt(i)) | 0
    }
    const envHash = Math.abs(hash).toString(36).substring(0, 6)

    // Compose: timestamp(base36) - random(base36) - envHash
    const id = `${timestamp.toString(36)}-${randomBits.toString(36).padStart(3, '0')}-${envHash}`
    return id
  }

  /**
   * Get the device's unique ID. Auto-generates one if not exists.
   * Once created, it persists forever in localStorage.
   */
  function getDeviceId(): string {
    if (!import.meta.client) return ''

    let id = localStorage.getItem('device_id')
    if (!id) {
      id = generateDeviceId()
      localStorage.setItem('device_id', id)
    }
    return id
  }

  /**
   * Get a human-readable device name from the environment.
   */
  function getDeviceName(): string {
    if (!import.meta.client) return 'Unknown'

    const ua = navigator.userAgent || ''

    // Detect device type
    if (/iPad/i.test(ua)) return 'iPad'
    if (/iPhone/i.test(ua)) return 'iPhone'
    if (/Android.*Mobile/i.test(ua)) return 'Android Phone'
    if (/Android/i.test(ua)) return 'Android Tablet'
    if (/Macintosh/i.test(ua)) return 'Mac'
    if (/Windows/i.test(ua)) return 'Windows PC'
    if (/Linux/i.test(ua)) return 'Linux'
    if (/CrOS/i.test(ua)) return 'Chromebook'

    return 'Browser'
  }

  /**
   * Get a fingerprint string of the current environment.
   */
  function getFingerprint(): string {
    if (!import.meta.client) return ''
    const parts = [
      navigator.userAgent || '',
      `${screen?.width || 0}x${screen?.height || 0}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      navigator.platform || '',
      navigator.language || '',
    ]
    return parts.join('|')
  }

  return { getDeviceId, getDeviceName, getFingerprint }
}
