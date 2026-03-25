function saveSession(id: number, name: string) {
  if (import.meta.client) {
    localStorage.setItem('auth_session', JSON.stringify({ accountId: id, accountName: name }))
  }
}

function loadSession(): { accountId: number; accountName: string } | null {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem('auth_session')
      if (raw) return JSON.parse(raw)
    } catch {}
  }
  return null
}

function clearSession() {
  if (import.meta.client) {
    localStorage.removeItem('auth_session')
  }
}

export const useAuthStore = defineStore('auth', () => {
  const unlocked = ref(false)
  const initialized = ref(false)
  const loading = ref(false)
  const accountId = ref<number>(0)
  const accountName = ref('')

  const pendingTOTP = ref(false)
  const pendingAccountId = ref(0)
  const pendingAccountName = ref('')

  async function checkStatus() {
    try {
      loading.value = true
      const data = await $fetch<{ initialized: boolean; accountCount: number }>('/api/auth/status')
      initialized.value = data.initialized
      return data
    } catch {
      initialized.value = false
      return { initialized: false, accountCount: 0 }
    } finally {
      loading.value = false

      // Restore session from localStorage
      if (!unlocked.value) {
        const session = loadSession()
        if (session && session.accountId > 0) {
          accountId.value = session.accountId
          accountName.value = session.accountName
          unlocked.value = true
          initialized.value = true
        }
      }
    }
  }

  async function unlock(password: string, totpCode?: string, backupCode?: string, deviceId?: string, deviceSignature?: string) {
    try {
      loading.value = true
      const body: any = { password }
      if (totpCode) body.totpCode = totpCode
      if (backupCode) body.backupCode = backupCode
      if (deviceId) body.deviceId = deviceId
      if (deviceSignature) body.deviceSignature = deviceSignature

      const data = await $fetch<any>('/api/auth/unlock', { method: 'POST', body })

      if (data.requiresTOTP) {
        pendingTOTP.value = true
        pendingAccountId.value = data.accountId
        pendingAccountName.value = data.accountName
        return data
      }

      if (data.success) {
        unlocked.value = true
        accountId.value = data.accountId
        accountName.value = data.accountName
        pendingTOTP.value = false
        saveSession(data.accountId, data.accountName)
      }
      return data
    } catch (error: any) {
      throw new Error(error?.data?.statusMessage || error?.data?.message || 'Login failed')
    } finally {
      loading.value = false
    }
  }

  async function verifyTOTP(code: string, isBackupCode = false) {
    // Re-send the login with TOTP code
    // The backend unlock endpoint handles TOTP verification
    // This is a convenience wrapper - the actual password must be passed from the UI
  }

  async function loginWithPasskey() {
    try {
      loading.value = true
      // 1. Get auth options
      const options = await $fetch<any>('/api/auth/passkey/auth-options', { method: 'POST' })
      // 2. Trigger browser WebAuthn
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const authResp = await startAuthentication({ optionsJSON: options })
      // 3. Verify with server
      const result = await $fetch<any>('/api/auth/passkey/auth-verify', {
        method: 'POST',
        body: { response: authResp },
      })
      if (result.success) {
        unlocked.value = true
        accountId.value = result.accountId
        accountName.value = result.accountName
        saveSession(result.accountId, result.accountName)
      }
      return result
    } catch (error: any) {
      throw new Error(error?.data?.statusMessage || error?.message || 'Passkey failed')
    } finally {
      loading.value = false
    }
  }

  function cancelTOTP() {
    pendingTOTP.value = false
    pendingAccountId.value = 0
    pendingAccountName.value = ''
  }

  async function createAccount(password: string, confirmPassword: string, name?: string) {
    try {
      loading.value = true
      const data = await $fetch<{ success: boolean; accountId: number; accountName: string }>('/api/auth/setup', {
        method: 'POST',
        body: { password, confirmPassword, name },
      })
      if (data.success) {
        initialized.value = true
        unlocked.value = true
        accountId.value = data.accountId as number
        accountName.value = data.accountName
        saveSession(data.accountId as number, data.accountName)
      }
      return data
    } catch (error: any) {
      throw new Error(error?.data?.statusMessage || error?.data?.message || '创建失败')
    } finally {
      loading.value = false
    }
  }

  function lock() {
    unlocked.value = false
    accountId.value = 0
    accountName.value = ''
    clearSession()
    navigateTo('/unlock')
  }

  return {
    unlocked,
    initialized,
    loading,
    accountId,
    accountName,
    pendingTOTP,
    pendingAccountId,
    pendingAccountName,
    checkStatus,
    unlock,
    verifyTOTP,
    loginWithPasskey,
    cancelTOTP,
    createAccount,
    lock,
  }
})
