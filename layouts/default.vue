<script setup lang="ts">
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const { t, toggleLocale, isZh } = useI18n()

const mobileMenuOpen = ref(false)
const notifUnreadCount = ref(0)

async function fetchUnreadCount() {
  try {
    const res = await $fetch<any>('/api/notifications', { query: { pageSize: 1 } })
    notifUnreadCount.value = res?.unread_count || 0
  } catch {}
}

onMounted(() => {
  fetchUnreadCount()
})

// Refresh unread count on route change
watch(() => route.path, () => {
  fetchUnreadCount()
})

// Navigation grouped by function
const navGroups = computed(() => [
  {
    items: [
      { label: t('nav.dashboard'), icon: 'material-symbols:dashboard', path: '/dashboard' },
      { label: t('nav.domainList'), icon: 'material-symbols:domain', path: '/domains' },
      { label: t('nav.dropcatch'), icon: 'material-symbols:timer-outline', path: '/dropcatch' },
    ],
  },
  {
    items: [
      { label: t('nav.statistics'), icon: 'material-symbols:analytics', path: '/statistics' },
      { label: t('nav.whoisQuery'), icon: 'material-symbols:search', path: '/whois' },
      { label: t('nav.importExport'), icon: 'material-symbols:import-export', path: '/import-export' },
    ],
  },
  {
    items: [
      { label: t('notifications.title'), icon: 'material-symbols:notifications', path: '/notifications' },
      { label: t('nav.emailSettings'), icon: 'material-symbols:mail', path: '/email-settings' },
      { label: t('nav.showcaseSettings'), icon: 'material-symbols:storefront', path: '/showcase-settings' },
    ],
  },
  {
    items: [
      { label: t('nav.security'), icon: 'material-symbols:security', path: '/security' },
      { label: t('nav.systemSettings'), icon: 'material-symbols:settings', path: '/settings' },
      { label: t('nav.backupSync'), icon: 'material-symbols:backup', path: '/backup-sync' },
      { label: t('nav.aboutProject'), icon: 'material-symbols:info', path: '/about' },
    ],
  },
])

// Flat list for mobile menu
const navItems = computed(() => navGroups.value.flatMap(g => g.items))

function isActive(path: string) {
  if (path === '/dashboard') return route.path === '/dashboard'
  return route.path.startsWith(path)
}

function handleNavClick(item: { label: string; path: string }) {
  appStore.setPageTitle(item.label)
  mobileMenuOpen.value = false
  navigateTo(item.path)
}

// Close mobile menu on route change
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

// Close mobile menu on escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    mobileMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50">
    <!-- Mobile overlay -->
    <Transition name="fade">
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-900 transition-all duration-300 ease-in-out dark-scrollbar',
        appStore.sidebarCollapsed ? 'w-16' : 'w-[260px]',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:relative',
      ]"
    >
      <!-- Logo area -->
      <div class="flex h-16 items-center gap-3 px-4 border-b border-gray-700/50">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
          DM
        </div>
        <Transition name="fade">
          <div v-if="!appStore.sidebarCollapsed" class="overflow-hidden">
            <h1 class="text-white font-semibold text-sm whitespace-nowrap">{{ t('header.systemName') }}</h1>
            <p class="text-gray-400 text-xs whitespace-nowrap">{{ t('header.subtitle') }}</p>
          </div>
        </Transition>
      </div>

      <!-- Navigation (grouped) -->
      <nav class="flex-1 overflow-y-auto py-3 px-3">
        <template v-for="(group, gi) in navGroups" :key="gi">
          <div v-if="gi > 0" class="my-2 mx-2 border-t border-gray-700/40" />
          <div class="space-y-0.5">
            <button
              v-for="item in group.items"
              :key="item.path"
              :class="[
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive(item.path)
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              ]"
              :title="appStore.sidebarCollapsed ? item.label : undefined"
              @click="handleNavClick(item)"
            >
              <Icon
                :name="item.icon"
                class="h-5 w-5 shrink-0 transition-colors duration-150"
                :class="isActive(item.path) ? 'text-white' : 'text-gray-400 group-hover:text-white'"
              />
              <Transition name="fade">
                <span v-if="!appStore.sidebarCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
              </Transition>
            </button>
          </div>
        </template>
      </nav>

      <!-- Go to showcase button -->
      <div class="border-t border-gray-700/50 px-3 pt-3">
        <a
          href="/show"
          target="_blank"
          rel="noopener"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
          :title="appStore.sidebarCollapsed ? t('show.footer.home') : undefined"
        >
          <Icon name="material-symbols:open-in-new" class="h-5 w-5 shrink-0" />
          <Transition name="fade">
            <span v-if="!appStore.sidebarCollapsed" class="whitespace-nowrap">{{ t('show.footer.home') }}</span>
          </Transition>
        </a>
      </div>

      <!-- Account info + collapse toggle -->
      <div class="hidden lg:block border-t border-gray-700/50 p-3 space-y-1">
        <Transition name="fade">
          <div v-if="!appStore.sidebarCollapsed && authStore.accountName" class="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
            <div class="h-6 w-6 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-300 font-bold text-xs shrink-0">
              {{ authStore.accountName.charAt(0) }}
            </div>
            <span class="truncate">{{ authStore.accountName }}</span>
          </div>
        </Transition>
        <button
          class="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
          @click="appStore.toggleSidebar()"
        >
          <Icon
            :name="appStore.sidebarCollapsed ? 'material-symbols:chevron-right' : 'material-symbols:chevron-left'"
            class="h-5 w-5 shrink-0 transition-transform duration-300"
          />
          <Transition name="fade">
            <span v-if="!appStore.sidebarCollapsed" class="whitespace-nowrap">{{ t('nav.collapseSidebar') }}</span>
          </Transition>
        </button>
      </div>
    </aside>

    <!-- Main content area -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6 shadow-sm">
        <!-- Mobile menu toggle -->
        <button
          class="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <Icon name="material-symbols:menu" class="h-5 w-5" />
        </button>

        <!-- Page title -->
        <h2 class="text-lg font-semibold text-gray-800 hidden sm:block">
          {{ appStore.currentPageTitle }}
        </h2>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Global search -->
        <div class="relative hidden md:block">
          <Icon
            name="material-symbols:search"
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          />
          <input
            v-model="appStore.searchQuery"
            type="text"
            :placeholder="t('header.searchPlaceholder')"
            class="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 input-focus"
          />
        </div>

        <!-- Sync status indicator -->
        <div class="flex items-center gap-1.5 text-sm text-gray-500">
          <span class="h-2 w-2 rounded-full bg-green-400" />
          <span class="hidden sm:inline">{{ t('header.synced') }}</span>
        </div>

        <!-- Notification bell -->
        <button
          class="relative flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          :title="t('notifications.title')"
          @click="navigateTo('/notifications')"
        >
          <Icon name="material-symbols:notifications" class="h-5 w-5" />
          <span
            v-if="notifUnreadCount > 0"
            class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          >
            {{ notifUnreadCount > 99 ? '99+' : notifUnreadCount }}
          </span>
        </button>

        <!-- Language toggle -->
        <button
          class="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          @click="toggleLocale"
        >
          {{ isZh ? 'EN' : '中文' }}
        </button>

        <!-- Lock button -->
        <button
          class="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          :title="t('header.lockSystem')"
          @click="authStore.lock()"
        >
          <Icon name="material-symbols:lock" class="h-5 w-5" />
        </button>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <slot />
      </main>
    </div>

    <!-- Toast container -->
    <CommonToast />
  </div>
</template>
