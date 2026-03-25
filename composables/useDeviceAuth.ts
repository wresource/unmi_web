/**
 * Cryptographic device authentication using Web Crypto API.
 *
 * Private key is stored as non-extractable in IndexedDB.
 * Even if an attacker accesses IndexedDB, they cannot export the private key.
 * The key can only be used for signing on THIS device's browser.
 */

const DB_NAME = 'unmi_device_auth'
const STORE_NAME = 'keys'
const KEY_ID = 'device_key'
const DEVICE_ID_KEY = 'device_id'

// ---- IndexedDB helpers ----

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<any> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ---- Crypto helpers ----

function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToArrayBuffer(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - b64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function useDeviceAuth() {
  /**
   * Check if Web Crypto API is available.
   */
  function isSupported(): boolean {
    return import.meta.client && !!window.crypto?.subtle && !!window.indexedDB
  }

  /**
   * Generate a new ECDSA P-256 key pair.
   * Private key is NON-EXTRACTABLE — cannot be read by JavaScript.
   */
  async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // extractable = false for PRIVATE key security
      ['sign', 'verify']
    )
  }

  /**
   * Export public key as JWK (JSON Web Key) for sending to server.
   */
  async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
    return await crypto.subtle.exportKey('jwk', key)
  }

  /**
   * Generate a device ID from the public key (SHA-256 fingerprint).
   */
  async function computeDeviceId(publicKeyJwk: JsonWebKey): Promise<string> {
    const keyStr = JSON.stringify(publicKeyJwk)
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyStr))
    return arrayBufferToBase64url(hash).substring(0, 16)
  }

  /**
   * Get or create the device's key pair.
   * On first call, generates keys and stores in IndexedDB.
   * Returns { deviceId, publicKeyJwk }.
   */
  async function getOrCreateDevice(): Promise<{ deviceId: string; publicKeyJwk: JsonWebKey } | null> {
    if (!isSupported()) return null

    try {
      // Try to load existing keys
      const existing = await idbGet(KEY_ID)
      if (existing?.privateKey && existing?.publicKeyJwk && existing?.deviceId) {
        return { deviceId: existing.deviceId, publicKeyJwk: existing.publicKeyJwk }
      }

      // Generate new key pair
      const keyPair = await generateKeyPair()
      const publicKeyJwk = await exportPublicKey(keyPair.publicKey)
      const deviceId = await computeDeviceId(publicKeyJwk)

      // Store: privateKey as CryptoKey (non-extractable), publicKeyJwk, deviceId
      await idbSet(KEY_ID, {
        privateKey: keyPair.privateKey,  // Non-extractable CryptoKey object
        publicKeyJwk,
        deviceId,
      })

      // Also store deviceId in localStorage for quick access
      localStorage.setItem(DEVICE_ID_KEY, deviceId)

      return { deviceId, publicKeyJwk }
    } catch (e) {
      console.warn('[device-auth] Failed to create device keys:', e)
      return null
    }
  }

  /**
   * Get the stored device ID (quick, from localStorage).
   */
  function getDeviceId(): string {
    if (!import.meta.client) return ''
    return localStorage.getItem(DEVICE_ID_KEY) || ''
  }

  /**
   * Sign a challenge with the device's private key.
   * This is the core security mechanism — only this device can produce a valid signature.
   */
  async function signChallenge(challengeBase64url: string): Promise<string | null> {
    if (!isSupported()) return null

    try {
      const stored = await idbGet(KEY_ID)
      if (!stored?.privateKey) return null

      const challengeBuffer = base64urlToArrayBuffer(challengeBase64url)
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        stored.privateKey,  // Non-extractable — browser handles this internally
        challengeBuffer
      )

      return arrayBufferToBase64url(signature)
    } catch (e) {
      console.warn('[device-auth] Failed to sign challenge:', e)
      return null
    }
  }

  /**
   * Get a human-readable device name.
   */
  function getDeviceName(): string {
    if (!import.meta.client) return 'Unknown'
    const ua = navigator.userAgent || ''
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
   * Clear device keys (used when removing device authorization).
   */
  async function clearDeviceKeys(): Promise<void> {
    if (!import.meta.client) return
    try {
      await idbDelete(KEY_ID)
      localStorage.removeItem(DEVICE_ID_KEY)
    } catch {}
  }

  return {
    isSupported,
    getOrCreateDevice,
    getDeviceId,
    signChallenge,
    getDeviceName,
    clearDeviceKeys,
  }
}
