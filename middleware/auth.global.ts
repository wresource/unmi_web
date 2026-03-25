export default defineNuxtRouteMiddleware(async (to) => {
  // Always allow the unlock page
  if (to.path === '/' || to.path === '/unlock' || to.path.startsWith('/show')) return

  const authStore = useAuthStore()

  // Check system initialization status if not yet checked
  if (!authStore.initialized) {
    try {
      const data = await $fetch<{ initialized: boolean }>('/api/auth/status')
      authStore.initialized = data.initialized
    } catch {
      // If API fails, redirect to unlock
    }
  }

  // If store says not unlocked, try restoring from client storage
  if (import.meta.client && !authStore.unlocked) {
    const raw = localStorage.getItem('auth_session')
    if (raw) {
      try {
        const session = JSON.parse(raw)
        if (session.accountId > 0) {
          authStore.accountId = session.accountId
          authStore.accountName = session.accountName
          authStore.unlocked = true
          authStore.initialized = true
          return // Don't redirect
        }
      } catch {}
    }
  }

  // If not initialized or not unlocked, redirect to unlock page
  if (!authStore.initialized || !authStore.unlocked) {
    return navigateTo('/unlock')
  }
})
