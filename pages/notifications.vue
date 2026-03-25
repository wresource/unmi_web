<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const appStore = useAppStore()
appStore.setPageTitle(t('notifications.title'))

const activeFilter = ref('')
const notificationsData = ref<any[]>([])
const notificationsTotal = ref(0)
const unreadCount = ref(0)
const page = ref(1)
const loading = ref(false)
const generating = ref(false)
const generatedMessage = ref('')

const filterTabs = computed(() => [
  { key: '', label: t('notifications.all') },
  { key: 'expiry_urgent,expiry_warning', label: t('notifications.expiryWarning') },
  { key: 'expired', label: t('notifications.expired') },
  { key: 'daily_summary', label: t('notifications.dailySummary') },
])

const typeIcons: Record<string, string> = {
  expiry_urgent: 'material-symbols:warning',
  expiry_warning: 'material-symbols:schedule',
  expired: 'material-symbols:error',
  daily_summary: 'material-symbols:summarize',
}

const typeColors: Record<string, string> = {
  expiry_urgent: 'text-red-500 bg-red-50',
  expiry_warning: 'text-amber-500 bg-amber-50',
  expired: 'text-gray-500 bg-gray-100',
  daily_summary: 'text-blue-500 bg-blue-50',
}

const typeLabels = computed<Record<string, string>>(() => ({
  expiry_urgent: t('notifications.expiryUrgent'),
  expiry_warning: t('notifications.expiryWarning'),
  expired: t('notifications.expired'),
  daily_summary: t('notifications.dailySummary'),
}))

async function loadNotifications() {
  loading.value = true
  try {
    const query: Record<string, any> = { page: page.value, pageSize: 20 }
    if (activeFilter.value) {
      query.type = activeFilter.value
    }
    const res = await $fetch<any>('/api/notifications', { query })
    notificationsData.value = res?.data || []
    notificationsTotal.value = res?.total || 0
    unreadCount.value = res?.unread_count || 0
  } catch {} finally {
    loading.value = false
  }
}

async function markAllRead() {
  try {
    await $fetch('/api/notifications/read', {
      method: 'PUT',
      body: { all: true },
    })
    await loadNotifications()
  } catch {}
}

async function markAsRead(notification: any) {
  if (notification.is_read) {
    if (notification.domain_id) {
      navigateTo(`/domains/${notification.domain_id}`)
    }
    return
  }
  try {
    await $fetch('/api/notifications/read', {
      method: 'PUT',
      body: { ids: [notification.id] },
    })
    notification.is_read = 1
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    if (notification.domain_id) {
      navigateTo(`/domains/${notification.domain_id}`)
    }
  } catch {}
}

async function generateNotifications() {
  generating.value = true
  generatedMessage.value = ''
  try {
    const res = await $fetch<any>('/api/notifications/generate', { method: 'POST' })
    generatedMessage.value = t('notifications.generated', { n: res?.generated || 0 })
    await loadNotifications()
    setTimeout(() => { generatedMessage.value = '' }, 3000)
  } catch {} finally {
    generating.value = false
  }
}

// Settings
const showSettings = ref(false)
const notifSettings = reactive({
  expiry_7d_enabled: 'true',
  expiry_30d_enabled: 'true',
  daily_summary_enabled: 'true',
})
const settingsSaving = ref(false)
const settingsSaved = ref(false)

async function loadSettings() {
  try {
    const res = await $fetch<any>('/api/notifications/settings')
    if (res?.data) {
      Object.assign(notifSettings, res.data)
    }
  } catch {}
}

async function saveSettings() {
  settingsSaving.value = true
  try {
    await $fetch('/api/notifications/settings', {
      method: 'PUT',
      body: { ...notifSettings },
    })
    settingsSaved.value = true
    setTimeout(() => { settingsSaved.value = false }, 2000)
  } catch {} finally {
    settingsSaving.value = false
  }
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}天前`
  return dateStr.split('T')[0] || dateStr.split(' ')[0] || dateStr
}

watch([activeFilter, page], () => {
  loadNotifications()
})

onMounted(() => {
  loadNotifications()
  loadSettings()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-gray-900">{{ t('notifications.title') }}</h1>
          <span
            v-if="unreadCount > 0"
            class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white"
          >
            {{ t('notifications.unread', { n: unreadCount }) }}
          </span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            class="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            @click="showSettings = !showSettings"
          >
            <Icon name="material-symbols:settings" class="h-4 w-4 mr-1 inline-block" />
            {{ t('notifications.settings') }}
          </button>
          <button
            :disabled="unreadCount === 0"
            class="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            @click="markAllRead"
          >
            {{ t('notifications.markAllRead') }}
          </button>
          <button
            :disabled="generating"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            @click="generateNotifications"
          >
            {{ generating ? t('notifications.generating') : t('notifications.generateNotifications') }}
          </button>
        </div>
      </div>
      <p v-if="generatedMessage" class="mt-2 text-sm text-green-600">{{ generatedMessage }}</p>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('notifications.settings') }}</h3>
      <div class="space-y-3 max-w-md">
        <label class="flex items-center gap-3 cursor-pointer">
          <button
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              notifSettings.expiry_7d_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-200',
            ]"
            @click="notifSettings.expiry_7d_enabled = notifSettings.expiry_7d_enabled === 'true' ? 'false' : 'true'"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                notifSettings.expiry_7d_enabled === 'true' ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
          <span class="text-sm text-gray-700">{{ t('notifications.expiry7dEnabled') }}</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <button
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              notifSettings.expiry_30d_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-200',
            ]"
            @click="notifSettings.expiry_30d_enabled = notifSettings.expiry_30d_enabled === 'true' ? 'false' : 'true'"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                notifSettings.expiry_30d_enabled === 'true' ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
          <span class="text-sm text-gray-700">{{ t('notifications.expiry30dEnabled') }}</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <button
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              notifSettings.daily_summary_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-200',
            ]"
            @click="notifSettings.daily_summary_enabled = notifSettings.daily_summary_enabled === 'true' ? 'false' : 'true'"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                notifSettings.daily_summary_enabled === 'true' ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
          <span class="text-sm text-gray-700">{{ t('notifications.dailySummaryEnabled') }}</span>
        </label>
      </div>
      <button
        :disabled="settingsSaving"
        class="mt-4 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        @click="saveSettings"
      >
        {{ settingsSaved ? t('notifications.settingsSaved') : settingsSaving ? t('common.saving') : t('common.save') }}
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="border-b border-gray-200">
        <nav class="flex overflow-x-auto px-4">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            :class="[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeFilter === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ]"
            @click="activeFilter = tab.key; page = 1"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>

        <!-- Empty state -->
        <div v-else-if="notificationsData.length === 0" class="text-center py-12 text-gray-500">
          <Icon name="material-symbols:notifications-off" class="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{{ t('notifications.noNotifications') }}</p>
        </div>

        <!-- Notification list -->
        <div v-else class="space-y-3">
          <div
            v-for="notif in notificationsData"
            :key="notif.id"
            :class="[
              'flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors',
              notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50',
            ]"
            @click="markAsRead(notif)"
          >
            <!-- Icon -->
            <div
              :class="[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                typeColors[notif.type] || 'text-gray-500 bg-gray-100',
              ]"
            >
              <Icon :name="typeIcons[notif.type] || 'material-symbols:notifications'" class="h-5 w-5" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 :class="['text-sm font-medium', notif.is_read ? 'text-gray-700' : 'text-gray-900']">
                      {{ notif.title }}
                    </h4>
                    <span
                      v-if="!notif.is_read"
                      class="h-2 w-2 rounded-full bg-blue-500 shrink-0"
                    />
                  </div>
                  <span class="text-xs text-gray-400 mt-0.5 inline-block">
                    {{ typeLabels[notif.type] || notif.type }}
                  </span>
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {{ formatTime(notif.created_at) }}
                </span>
              </div>
              <p v-if="notif.message" class="text-sm text-gray-500 mt-1">{{ notif.message }}</p>
              <div v-if="notif.domain_name" class="mt-1">
                <span class="text-xs text-blue-600 hover:underline">{{ notif.domain_name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="notificationsTotal > 20" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span class="text-sm text-gray-500">{{ t('common.total', { n: notificationsTotal }) }}</span>
          <div class="flex gap-1">
            <button
              :disabled="page <= 1"
              class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              @click="page--"
            >
              {{ t('common.prev') }}
            </button>
            <button
              :disabled="page * 20 >= notificationsTotal"
              class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              @click="page++"
            >
              {{ t('common.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
