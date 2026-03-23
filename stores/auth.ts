export const useAuthStore = defineStore('auth', () => {
  const unlocked = ref(false)
  const initialized = ref(false)
  const loading = ref(false)
  const accountId = ref<number>(0)
  const accountName = ref('')

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
    }
  }

  async function unlock(password: string) {
    try {
      loading.value = true
      const data = await $fetch<{ success: boolean; accountId: number; accountName: string }>('/api/auth/unlock', {
        method: 'POST',
        body: { password },
      })
      if (data.success) {
        unlocked.value = true
        accountId.value = data.accountId
        accountName.value = data.accountName
      }
      return data
    } catch (error: any) {
      throw new Error(error?.data?.statusMessage || error?.data?.message || '登录失败')
    } finally {
      loading.value = false
    }
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
    navigateTo('/unlock')
  }

  return {
    unlocked,
    initialized,
    loading,
    accountId,
    accountName,
    checkStatus,
    unlock,
    createAccount,
    lock,
  }
})
