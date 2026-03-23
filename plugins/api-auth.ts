export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()

  globalThis.$fetch = new Proxy(globalThis.$fetch, {
    apply(target, thisArg, args: [any, any]) {
      const [url, opts = {}] = args

      // Only add header for internal API calls
      if (typeof url === 'string' && url.startsWith('/api/')) {
        opts.headers = {
          ...(opts.headers || {}),
          'x-account-id': String(authStore.accountId || 0),
        }
      }

      return Reflect.apply(target, thisArg, [url, opts])
    },
  })
})
