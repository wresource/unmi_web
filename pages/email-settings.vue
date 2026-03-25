<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()
const appStore = useAppStore()

appStore.setPageTitle(t('email.title'))

// State
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const sendingSummary = ref(false)
const discovering = ref(false)

// SMTP form
const emailPrefix = ref('')
const selectedSuffix = ref('')
const customDomain = ref('')
const smtpHost = ref('')
const smtpPort = ref('465')
const smtpSecure = ref(true)
const authCode = ref('')
const hasPassword = ref(false)

// Recipient
const recipientEmail = ref('')

// Notification types
const emailExpiry7d = ref(true)
const emailExpiry30d = ref(true)
const emailExpired = ref(true)

// Summary schedule
const emailSummarySchedule = ref('never')

// Suffixes from API
const suffixes = ref<{ domain: string; label: string }[]>([])

// Computed: full sender email
const senderEmail = computed(() => {
  const suffix = selectedSuffix.value === 'custom' ? customDomain.value : selectedSuffix.value
  if (!emailPrefix.value || !suffix) return ''
  return `${emailPrefix.value}@${suffix}`
})

// Computed: whether it's custom domain
const isCustom = computed(() => selectedSuffix.value === 'custom')

// Load suffixes
async function loadSuffixes() {
  try {
    const res = await $fetch<any>('/api/email/suffixes')
    suffixes.value = res.data || []
  } catch {}
}

// Load saved settings
async function loadSettings() {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/email/settings')
    const data = res.data || {}

    smtpHost.value = data.smtp_host || ''
    smtpPort.value = data.smtp_port || '465'
    smtpSecure.value = data.smtp_secure !== false
    hasPassword.value = data.has_password || false
    recipientEmail.value = data.recipient_email || ''
    emailExpiry7d.value = data.email_expiry_7d !== false
    emailExpiry30d.value = data.email_expiry_30d !== false
    emailExpired.value = data.email_expired !== false
    emailSummarySchedule.value = data.email_summary_schedule || 'never'

    // Parse smtp_user back into prefix and suffix
    const smtpUser = data.smtp_user || ''
    if (smtpUser && smtpUser.includes('@')) {
      const [prefix, domain] = smtpUser.split('@')
      emailPrefix.value = prefix
      const knownSuffix = suffixes.value.find(s => s.domain === domain)
      if (knownSuffix) {
        selectedSuffix.value = domain
      } else if (domain) {
        selectedSuffix.value = 'custom'
        customDomain.value = domain
      }
    }
  } catch {}
  loading.value = false
}

// When suffix changes, auto-fill SMTP settings
watch(selectedSuffix, (val) => {
  if (val && val !== 'custom') {
    const known = suffixes.value.find(s => s.domain === val)
    if (known) {
      autoFillSmtp(val)
    }
  }
})

function autoFillSmtp(domain: string) {
  // Use the SMTP_SERVERS map via the discover endpoint for known domains
  const knownSmtp: Record<string, { host: string; port: string; secure: boolean }> = {
    'qq.com': { host: 'smtp.qq.com', port: '465', secure: true },
    'foxmail.com': { host: 'smtp.qq.com', port: '465', secure: true },
    '163.com': { host: 'smtp.163.com', port: '465', secure: true },
    '126.com': { host: 'smtp.126.com', port: '465', secure: true },
    'sina.com': { host: 'smtp.sina.com', port: '465', secure: true },
    'aliyun.com': { host: 'smtp.aliyun.com', port: '465', secure: true },
    'gmail.com': { host: 'smtp.gmail.com', port: '465', secure: true },
    'outlook.com': { host: 'smtp-mail.outlook.com', port: '587', secure: false },
    'hotmail.com': { host: 'smtp-mail.outlook.com', port: '587', secure: false },
    'yahoo.com': { host: 'smtp.mail.yahoo.com', port: '465', secure: true },
    'icloud.com': { host: 'smtp.mail.me.com', port: '587', secure: false },
    'zoho.com': { host: 'smtp.zoho.com', port: '465', secure: true },
    'yandex.com': { host: 'smtp.yandex.com', port: '465', secure: true },
    'mail.ru': { host: 'smtp.mail.ru', port: '465', secure: true },
    'fastmail.com': { host: 'smtp.fastmail.com', port: '465', secure: true },
    'protonmail.com': { host: 'smtp.protonmail.ch', port: '465', secure: true },
  }
  const config = knownSmtp[domain]
  if (config) {
    smtpHost.value = config.host
    smtpPort.value = config.port
    smtpSecure.value = config.secure
  }
}

// Discover SMTP for custom domain
async function handleDiscover() {
  if (!customDomain.value) return
  discovering.value = true
  try {
    const res = await $fetch<any>('/api/email/discover', {
      method: 'POST',
      body: { domain: customDomain.value },
    })
    if (res.success && res.data) {
      smtpHost.value = res.data.host
      smtpPort.value = String(res.data.port)
      smtpSecure.value = res.data.secure
      toast.success(t('email.smtpFound'))
    } else {
      toast.warning(t('email.smtpNotFound'))
    }
  } catch {
    toast.warning(t('email.smtpNotFound'))
  }
  discovering.value = false
}

// Save settings
async function handleSave() {
  saving.value = true
  try {
    const body: Record<string, any> = {
      smtp_host: smtpHost.value,
      smtp_port: smtpPort.value,
      smtp_secure: String(smtpSecure.value),
      smtp_user: senderEmail.value,
      recipient_email: recipientEmail.value,
      email_expiry_7d: String(emailExpiry7d.value),
      email_expiry_30d: String(emailExpiry30d.value),
      email_expired: String(emailExpired.value),
      email_summary_schedule: emailSummarySchedule.value,
    }
    if (authCode.value) {
      body.smtp_pass = authCode.value
    }
    await $fetch('/api/email/settings', { method: 'PUT', body })
    hasPassword.value = hasPassword.value || !!authCode.value
    toast.success(t('email.saved'))
  } catch {
    toast.error(t('common.failed'))
  }
  saving.value = false
}

// Test email
async function handleTest() {
  if (!smtpHost.value || !senderEmail.value || !recipientEmail.value) {
    toast.warning(t('email.testFailed'))
    return
  }
  if (!authCode.value && !hasPassword.value) {
    toast.warning(t('email.testFailed'))
    return
  }
  testing.value = true
  try {
    // If authCode is provided, use it directly; otherwise the server will use saved password
    // But test endpoint requires explicit password, so we need authCode for testing
    if (!authCode.value) {
      // Save first, then send via server
      await handleSave()
    }
    const res = await $fetch<any>('/api/email/test', {
      method: 'POST',
      body: {
        smtp_host: smtpHost.value,
        smtp_port: smtpPort.value,
        smtp_secure: smtpSecure.value,
        smtp_user: senderEmail.value,
        smtp_pass: authCode.value,
        recipient_email: recipientEmail.value,
      },
    })
    if (res.success) {
      toast.success(t('email.testSuccess'))
    } else {
      toast.error(`${t('email.testFailed')}: ${res.error || ''}`)
    }
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || ''
    toast.error(`${t('email.testFailed')}: ${msg}`)
  }
  testing.value = false
}

// Send summary now
async function handleSendSummary() {
  sendingSummary.value = true
  try {
    const res = await $fetch<any>('/api/email/send-summary', { method: 'POST' })
    if (res.success) {
      toast.success(t('email.summarySuccess'))
    } else {
      toast.error(`${t('email.summaryFailed')}: ${res.error || ''}`)
    }
  } catch {
    toast.error(t('email.summaryFailed'))
  }
  sendingSummary.value = false
}

const scheduleOptions = computed(() => [
  { value: 'never', label: t('email.scheduleNever') },
  { value: 'daily', label: t('email.scheduleDaily') },
  { value: 'weekly', label: t('email.scheduleWeekly') },
  { value: 'monthly', label: t('email.scheduleMonthly') },
])

onMounted(async () => {
  await loadSuffixes()
  await loadSettings()
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('email.title') }}</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Icon name="material-symbols:progress-activity" class="h-8 w-8 animate-spin text-blue-500" />
    </div>

    <template v-else>
      <!-- Section 1: SMTP Configuration -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="material-symbols:mail" class="h-5 w-5 text-blue-500" />
          {{ t('email.smtpConfig') }}
        </h2>

        <div class="space-y-4">
          <!-- Email account -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.emailPrefix') }}</label>
              <input
                v-model="emailPrefix"
                type="text"
                class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
                placeholder="username"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.emailSuffix') }}</label>
              <select
                v-model="selectedSuffix"
                class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
              >
                <option value="">--</option>
                <option v-for="s in suffixes" :key="s.domain" :value="s.domain">
                  @{{ s.domain }} ({{ s.label }})
                </option>
                <option value="custom">{{ t('email.customDomain') }}</option>
              </select>
            </div>
          </div>

          <!-- Custom domain input -->
          <div v-if="isCustom" class="flex gap-2">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.customDomain') }}</label>
              <input
                v-model="customDomain"
                type="text"
                class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
                placeholder="example.com"
              />
            </div>
            <div class="flex items-end">
              <button
                class="h-10 px-4 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50"
                :disabled="discovering || !customDomain"
                @click="handleDiscover"
              >
                {{ discovering ? t('email.discovering') : t('email.discoverSmtp') }}
              </button>
            </div>
          </div>

          <!-- Full email display -->
          <div v-if="senderEmail" class="text-sm text-gray-500">
            {{ senderEmail }}
          </div>

          <!-- SMTP settings (always visible but auto-filled for known providers) -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.smtpHost') }}</label>
              <input
                v-model="smtpHost"
                type="text"
                class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.smtpPort') }}</label>
              <input
                v-model="smtpPort"
                type="text"
                class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
                placeholder="465"
              />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  v-model="smtpSecure"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700">{{ t('email.smtpSecure') }}</span>
              </label>
            </div>
          </div>

          <!-- Auth code -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('email.authCode') }}</label>
            <input
              v-model="authCode"
              type="password"
              class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
              :placeholder="hasPassword ? '••••••••' : ''"
            />
            <p class="mt-1 text-xs text-gray-400">{{ t('email.authCodeHint') }}</p>
          </div>
        </div>
      </div>

      <!-- Section 2: Recipient -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="material-symbols:forward-to-inbox" class="h-5 w-5 text-green-500" />
          {{ t('email.recipient') }}
        </h2>
        <div>
          <input
            v-model="recipientEmail"
            type="email"
            class="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 input-focus"
            placeholder="recipient@example.com"
          />
          <p class="mt-1 text-xs text-gray-400">{{ t('email.recipientHint') }}</p>
        </div>
      </div>

      <!-- Section 3: Notification Types -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="material-symbols:notifications-active" class="h-5 w-5 text-orange-500" />
          {{ t('email.notificationTypes') }}
        </h2>
        <div class="space-y-3">
          <label class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <span class="text-sm text-gray-700">{{ t('email.expiry7d') }}</span>
            <div class="relative">
              <input v-model="emailExpiry7d" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </div>
          </label>
          <label class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <span class="text-sm text-gray-700">{{ t('email.expiry30d') }}</span>
            <div class="relative">
              <input v-model="emailExpiry30d" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </div>
          </label>
          <label class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <span class="text-sm text-gray-700">{{ t('email.expiredAlert') }}</span>
            <div class="relative">
              <input v-model="emailExpired" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </div>
          </label>
        </div>
      </div>

      <!-- Section 4: Summary Schedule -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="material-symbols:schedule" class="h-5 w-5 text-purple-500" />
          {{ t('email.summarySchedule') }}
        </h2>
        <div class="space-y-2">
          <label
            v-for="opt in scheduleOptions"
            :key="opt.value"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              v-model="emailSummarySchedule"
              type="radio"
              :value="opt.value"
              class="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">{{ opt.label }}</span>
          </label>
        </div>
        <p class="mt-3 text-xs text-gray-400">{{ t('email.scheduleDesc') }}</p>
      </div>

      <!-- Bottom Actions -->
      <div class="flex flex-wrap gap-3">
        <button
          class="h-10 px-5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          :disabled="saving"
          @click="handleSave"
        >
          <Icon v-if="saving" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin" />
          {{ saving ? t('common.saving') : t('email.saveSettings') }}
        </button>
        <button
          class="h-10 px-5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          :disabled="testing"
          @click="handleTest"
        >
          <Icon v-if="testing" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin" />
          {{ testing ? t('email.testing') : t('email.testEmail') }}
        </button>
        <button
          class="h-10 px-5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          :disabled="sendingSummary"
          @click="handleSendSummary"
        >
          <Icon v-if="sendingSummary" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin" />
          {{ t('email.sendSummaryNow') }}
        </button>
      </div>
    </template>
  </div>
</template>
