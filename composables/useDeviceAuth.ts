export function useDeviceAuth() {
  function getDeviceFingerprint(): string {
    if (!import.meta.client) return ''
    const parts = [
      navigator.userAgent,
      `${screen.width}x${screen.height}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.platform || '',
      navigator.language,
    ]
    return parts.join('|')
  }

  function getStoredDeviceId(): string | null {
    if (!import.meta.client) return null
    return localStorage.getItem('device_id')
  }

  function storeDeviceId(id: string) {
    if (import.meta.client) localStorage.setItem('device_id', id)
  }

  return { getDeviceFingerprint, getStoredDeviceId, storeDeviceId }
}
