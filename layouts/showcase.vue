<script setup lang="ts">
const route = useRoute()
const mobileMenuOpen = ref(false)
const { t, toggleLocale, isZh } = useI18n()

const navItems = computed(() => [
  { label: t('show.footer.home'), path: '/show' },
  { label: t('show.market.title'), path: '/show/domains' },
  { label: 'FAQ', path: '/show/faq' },
  { label: t('show.footer.aboutUs'), path: '/show/about' },
])

function isActive(path: string) {
  if (path === '/show') return route.path === '/show'
  return route.path.startsWith(path)
}

watch(() => route.path, () => {
  mobileMenuOpen.value = false
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/show" class="flex items-center gap-2 shrink-0">
            <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              U
            </div>
            <span class="text-xl font-bold text-gray-900 tracking-tight">UNMI.IO</span>
          </NuxtLink>

          <!-- Desktop Nav -->
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
              ]"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <!-- Right Actions -->
          <div class="flex items-center gap-3">
            <NuxtLink
              to="/show/domains"
              class="hidden sm:flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Icon name="material-symbols:search" class="h-5 w-5" />
            </NuxtLink>
            <NuxtLink
              to="/show/inquiry"
              class="hidden sm:inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              {{ t('show.contactUs') }}
            </NuxtLink>
            <button @click="toggleLocale" class="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              {{ isZh ? 'EN' : '中文' }}
            </button>
            <a
              href="/unlock"
              target="_blank"
              rel="noopener"
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs font-medium transition-colors"
              :title="t('show.admin')"
            >
              <Icon name="material-symbols:admin-panel-settings-outline" class="h-4 w-4" />
              {{ t('show.admin') }}
            </a>
            <!-- Mobile menu button -->
            <button
              class="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <Icon :name="mobileMenuOpen ? 'material-symbols:close' : 'material-symbols:menu'" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Nav -->
      <Transition name="slide-down">
        <div v-if="mobileMenuOpen" class="md:hidden border-t border-gray-100 bg-white">
          <nav class="max-w-7xl mx-auto px-4 py-3 space-y-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              :class="[
                'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50',
              ]"
              @click="mobileMenuOpen = false"
            >
              {{ item.label }}
            </NuxtLink>
            <NuxtLink
              to="/show/inquiry"
              class="block px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              @click="mobileMenuOpen = false"
            >
              {{ t('show.contactUs') }}
            </NuxtLink>
            <a
              href="/unlock"
              target="_blank"
              rel="noopener"
              class="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 transition-colors"
              @click="mobileMenuOpen = false"
            >
              {{ t('show.admin') }}
            </a>
          </nav>
        </div>
      </Transition>
    </header>

    <!-- Content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900 text-gray-400">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Top footer -->
        <div class="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <!-- Brand -->
          <div class="md:col-span-2">
            <div class="flex items-center gap-2 mb-4">
              <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                U
              </div>
              <span class="text-lg font-bold text-white">UNMI.IO</span>
            </div>
            <p class="text-sm leading-relaxed max-w-sm">
              {{ t('show.footer.desc') }}
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="text-white font-semibold text-sm mb-4">{{ t('show.footer.quickLinks') }}</h3>
            <ul class="space-y-2.5">
              <li><NuxtLink to="/show" class="text-sm hover:text-white transition-colors">{{ t('show.footer.home') }}</NuxtLink></li>
              <li><NuxtLink to="/show/domains" class="text-sm hover:text-white transition-colors">{{ t('show.footer.domainMarket') }}</NuxtLink></li>
              <li><NuxtLink to="/show/inquiry" class="text-sm hover:text-white transition-colors">{{ t('show.footer.domainInquiry') }}</NuxtLink></li>
              <li><NuxtLink to="/show/about" class="text-sm hover:text-white transition-colors">{{ t('show.footer.aboutUs') }}</NuxtLink></li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h3 class="text-white font-semibold text-sm mb-4">{{ t('show.footer.contactInfo') }}</h3>
            <ul class="space-y-2.5">
              <li class="flex items-center gap-2 text-sm">
                <Icon name="material-symbols:mail-outline" class="h-4 w-4" />
                <span>contact@unmi.io</span>
              </li>
              <li class="flex items-center gap-2 text-sm">
                <Icon name="material-symbols:language" class="h-4 w-4" />
                <span>unmi.io</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Bottom footer -->
        <div class="border-t border-gray-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm">&copy; 2026 UNMI.IO. All rights reserved.</p>
          <div class="flex items-center gap-4 text-sm">
            <NuxtLink to="/show/about" class="hover:text-white transition-colors">{{ t('show.footer.privacy') }}</NuxtLink>
            <NuxtLink to="/show/about" class="hover:text-white transition-colors">{{ t('show.footer.terms') }}</NuxtLink>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>
