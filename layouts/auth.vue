<script setup lang="ts">
const { t, toggleLocale, isZh } = useI18n()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
    <!-- Decorative background elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
      <div class="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
    </div>

    <div class="relative z-10 w-full max-w-md px-4">
      <!-- Logo -->
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <Icon name="material-symbols:domain" class="h-8 w-8 text-white" />
        </div>
        <h1 class="text-2xl font-bold text-white">{{ t('header.systemName') }}</h1>
        <p class="mt-1 text-sm text-gray-400">{{ t('header.subtitle') }}</p>
      </div>

      <!-- Content slot -->
      <slot />

      <!-- Language toggle -->
      <div class="mt-6 text-center">
        <button
          @click="toggleLocale"
          class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {{ isZh ? 'EN' : '中文' }}
        </button>
      </div>
    </div>

    <!-- Toast container -->
    <CommonToast />
  </div>
</template>
