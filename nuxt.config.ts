export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/icon',
  ],
  app: {
    head: {
      title: 'Domain Manager - 域名管理系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '本地优先的域名资产管理系统' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
  },
  runtimeConfig: {
    dbPath: './data/domain-manager.db',
  },
})
