<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)

// Security
const passwordForm = ref({
  current: '',
  new_password: '',
  confirm: '',
})
const changingPassword = ref(false)
const autoLockTimeout = ref(30)
const sessionTimeout = ref(7200000) // default 2 hours

// Load saved session timeout
onMounted(() => {
  try {
    const saved = localStorage.getItem('session_timeout')
    if (saved) sessionTimeout.value = parseInt(saved) || 7200000
  } catch {}
})

function saveSessionTimeout() {
  try {
    localStorage.setItem('session_timeout', String(sessionTimeout.value))
    // Update current session
    const raw = localStorage.getItem('auth_session')
    if (raw) {
      const session = JSON.parse(raw)
      session.timeout = sessionTimeout.value
      session.lastActivity = Date.now()
      localStorage.setItem('auth_session', JSON.stringify(session))
    }
    toast.success(t('common.saved'))
  } catch {}
}

// General
const defaultCurrency = ref('CNY')
const dateFormat = ref('YYYY-MM-DD')
const theme = ref('light')

// Import settings
const duplicateStrategy = ref('skip')

// Links
const githubUrl = ref('')
const projectSiteUrl = ref('')

const currencyOptions = [
  { label: 'CNY', value: 'CNY' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
]

const dateFormatOptions = [
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
]

const themeOptions = computed(() => [
  { label: t('settings.theme') + ' - Light', value: 'light' },
  { label: t('settings.theme') + ' - Dark', value: 'dark' },
  { label: t('settings.theme') + ' - Auto', value: 'auto' },
])

const autoLockOptions = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '-', value: 0 },
]

async function fetchSettings() {
  loading.value = true
  try {
    const data = await $fetch<any>('/api/settings')
    autoLockTimeout.value = data.auto_lock_timeout ?? 30
    defaultCurrency.value = data.default_currency ?? 'CNY'
    dateFormat.value = data.date_format ?? 'YYYY-MM-DD'
    theme.value = data.theme ?? 'light'
    duplicateStrategy.value = data.duplicate_strategy ?? 'skip'
    githubUrl.value = data.github_url ?? ''
    projectSiteUrl.value = data.project_site_url ?? ''
  } catch (e: any) {
    toast.error(e?.data?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: {
        auto_lock_timeout: autoLockTimeout.value,
        default_currency: defaultCurrency.value,
        date_format: dateFormat.value,
        theme: theme.value,
        duplicate_strategy: duplicateStrategy.value,
        github_url: githubUrl.value,
        project_site_url: projectSiteUrl.value,
      },
    })
    toast.success(t('common.saved'))
  } catch (e: any) {
    toast.error(e?.data?.message || t('common.failed'))
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  const { current, new_password, confirm } = passwordForm.value

  if (!current || !new_password || !confirm) {
    toast.warning(t('auth.errors.passwordRequired'))
    return
  }

  if (new_password.length < 6) {
    toast.warning(t('auth.errors.passwordMinLength'))
    return
  }

  if (new_password !== confirm) {
    toast.error(t('auth.errors.passwordMismatch'))
    return
  }

  changingPassword.value = true
  try {
    await $fetch('/api/settings/password', {
      method: 'PUT',
      body: {
        current_password: current,
        new_password: new_password,
      },
    })
    toast.success(t('common.success'))
    passwordForm.value = { current: '', new_password: '', confirm: '' }
  } catch (e: any) {
    toast.error(e?.data?.message || t('common.failed'))
  } finally {
    changingPassword.value = false
  }
}

onMounted(() => {
  fetchSettings()
})

const inputClass = 'h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors'
const selectClass = 'h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <span class="text-sm text-gray-500">{{ t('common.loading') }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Security settings -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Icon name="material-symbols:security" class="h-5 w-5 text-red-500" />
          <h3 class="text-base font-semibold text-gray-800">{{ t('settings.security') }}</h3>
        </div>
        <div class="p-6 space-y-5">
          <!-- Change password -->
          <div>
            <h4 class="mb-3 text-sm font-medium text-gray-700">{{ t('settings.changePassword') }}</h4>
            <div class="grid gap-3 sm:grid-cols-3">
              <div>
                <label class="mb-1 block text-xs text-gray-500">{{ t('settings.currentPassword') }}</label>
                <input
                  v-model="passwordForm.current"
                  type="password"
                  :class="inputClass"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-500">{{ t('settings.newPassword') }}</label>
                <input
                  v-model="passwordForm.new_password"
                  type="password"
                  :class="inputClass"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-500">{{ t('settings.confirmNewPassword') }}</label>
                <input
                  v-model="passwordForm.confirm"
                  type="password"
                  :class="inputClass"
                />
              </div>
            </div>
            <button
              :disabled="changingPassword"
              class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              @click="changePassword"
            >
              <div v-if="changingPassword" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {{ t('settings.changePassword') }}
            </button>
          </div>

          <!-- Auto lock -->
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.autoLock') }}</label>
            <select v-model="autoLockTimeout" :class="selectClass" class="max-w-xs">
              <option v-for="opt in autoLockOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Session timeout -->
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.sessionTimeout') }}</label>
            <p class="text-xs text-gray-400 mb-2">{{ t('settings.sessionTimeoutDesc') }}</p>
            <select v-model="sessionTimeout" :class="selectClass" class="max-w-xs" @change="saveSessionTimeout">
              <option :value="1800000">{{ t('settings.timeout30m') }}</option>
              <option :value="3600000">{{ t('settings.timeout1h') }}</option>
              <option :value="7200000">{{ t('settings.timeout2h') }}</option>
              <option :value="14400000">{{ t('settings.timeout4h') }}</option>
              <option :value="28800000">{{ t('settings.timeout8h') }}</option>
              <option :value="86400000">{{ t('settings.timeout24h') }}</option>
              <option :value="604800000">{{ t('settings.timeout7d') }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- General settings -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Icon name="material-symbols:tune" class="h-5 w-5 text-blue-500" />
          <h3 class="text-base font-semibold text-gray-800">{{ t('settings.general') }}</h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.defaultCurrency') }}</label>
            <select v-model="defaultCurrency" :class="selectClass" class="max-w-xs">
              <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.dateFormat') }}</label>
            <select v-model="dateFormat" :class="selectClass" class="max-w-xs">
              <option v-for="opt in dateFormatOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.theme') }}</label>
            <div class="flex gap-3">
              <label
                v-for="opt in [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'Auto', value: 'auto' }]"
                :key="opt.value"
                :class="[
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all',
                  theme === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                ]"
              >
                <input v-model="theme" type="radio" :value="opt.value" class="hidden" />
                {{ opt.label }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Import settings -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Icon name="material-symbols:import-export" class="h-5 w-5 text-amber-500" />
          <h3 class="text-base font-semibold text-gray-800">{{ t('settings.importSettings') }}</h3>
        </div>
        <div class="p-6">
          <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.duplicateStrategy') }}</label>
          <div class="flex gap-4 mt-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="duplicateStrategy" type="radio" value="skip" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">{{ t('settings.skip') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="duplicateStrategy" type="radio" value="overwrite" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">{{ t('settings.overwrite') }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Project links -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Icon name="material-symbols:link" class="h-5 w-5 text-purple-500" />
          <h3 class="text-base font-semibold text-gray-800">{{ t('settings.projectLinks') }}</h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.githubUrl') }}</label>
            <input
              v-model="githubUrl"
              type="url"
              placeholder="https://github.com/username/repo"
              :class="inputClass"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">{{ t('settings.projectSite') }}</label>
            <input
              v-model="projectSiteUrl"
              type="url"
              placeholder="https://example.com"
              :class="inputClass"
            />
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div class="flex justify-end">
        <button
          :disabled="saving"
          class="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          @click="saveSettings"
        >
          <div v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:save" class="h-4 w-4" />
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </template>
  </div>
</template>
