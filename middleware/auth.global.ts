export default defineNuxtRouteMiddleware(async (to) => {
  // Always allow public routes
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

  // Try restoring session from client storage (works on both SSR and client nav)
  if (!authStore.unlocked && import.meta.client) {
    const raw = localStorage.getItem('auth_session')
    if (raw) {
      try {
        const session = JSON.parse(raw)
        if (session.accountId > 0) {
          // Check session expiry
          const sessionTimeout = session.timeout || 7200000 // default 2 hours
          const lastActivity = session.lastActivity || 0
          const now = Date.now()

          if (lastActivity > 0 && (now - lastActivity) > sessionTimeout) {
            // Session expired — clear it
            localStorage.removeItem('auth_session')
          } else {
            // Session valid — restore and update activity time
            authStore.accountId = session.accountId
            authStore.accountName = session.accountName
            authStore.unlocked = true
            authStore.initialized = true
            // Update last activity
            session.lastActivity = now
            localStorage.setItem('auth_session', JSON.stringify(session))
            return
          }
        }
      } catch {
        localStorage.removeItem('auth_session')
      }
    }
  }

  // For SSR: if auth store is already unlocked (from client-side restore), allow
  if (authStore.unlocked) return

  // Not initialized or not unlocked → redirect to unlock page
  if (!authStore.initialized || !authStore.unlocked) {
    return navigateTo('/unlock')
  }
})
