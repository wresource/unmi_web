<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()

// --- State ---
const methods = ref<any>(null)
const loadingMethods = ref(true)

// TOTP
const showSetupModal = ref(false)
const setupData = ref<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] } | null>(null)
const setupCode = ref('')
const setupLoading = ref(false)
const setupStep = ref<'qr' | 'backup'>('qr')
const showDisableConfirm = ref(false)
const disablePassword = ref('')
const disableLoading = ref(false)
const showBackupCodesModal = ref(false)
const backupCodesPassword = ref('')
const backupCodesLoading = ref(false)
const backupCodesData = ref<string[] | null>(null)

// Devices
const devices = ref<any[]>([])
const devicesLoading = ref(false)
const addDeviceLoading = ref(false)

// Passkeys
const passkeys = ref<any[]>([])
const passkeysLoading = ref(false)
const showAddPasskey = ref(false)
const passkeyName = ref('')
const passkeyRegistering = ref(false)
const webAuthnSupported = ref(false)

onMounted(() => {
  webAuthnSupported.value = !!(window.PublicKeyCredential)
  fetchMethods()
  fetchDevices()
  fetchPasskeys()
})

// --- Fetch methods ---
async function fetchMethods() {
  try {
    loadingMethods.value = true
    methods.value = await $fetch<any>('/api/auth/methods')
  } catch {
    toast.error(t('common.failed'))
  } finally {
    loadingMethods.value = false
  }
}

// --- TOTP ---
async function startTOTPSetup() {
  try {
    setupLoading.value = true
    setupStep.value = 'qr'
    setupCode.value = ''
    const data = await $fetch<any>('/api/auth/totp/setup', { method: 'POST' })
    setupData.value = data
    showSetupModal.value = true
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  } finally {
    setupLoading.value = false
  }
}

async function confirmTOTPSetup() {
  if (!setupCode.value || setupCode.value.length !== 6) return
  try {
    setupLoading.value = true
    await $fetch('/api/auth/totp/verify-setup', {
      method: 'POST',
      body: { token: setupCode.value },
    })
    toast.success(t('security.totp.setupSuccess'))
    setupStep.value = 'backup'
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('auth.totpInvalid'))
  } finally {
    setupLoading.value = false
  }
}

async function disableTOTP() {
  if (!disablePassword.value) return
  try {
    disableLoading.value = true
    await $fetch('/api/auth/totp/disable', {
      method: 'POST',
      body: { password: disablePassword.value },
    })
    toast.success(t('security.totp.disableSuccess'))
    showDisableConfirm.value = false
    disablePassword.value = ''
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  } finally {
    disableLoading.value = false
  }
}

async function regenerateBackupCodes() {
  if (!backupCodesPassword.value) return
  try {
    backupCodesLoading.value = true
    const data = await $fetch<any>('/api/auth/totp/backup-codes', {
      method: 'POST',
      body: { password: backupCodesPassword.value },
    })
    backupCodesData.value = data.backupCodes || data
    backupCodesPassword.value = ''
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  } finally {
    backupCodesLoading.value = false
  }
}

function copyBackupCodes(codes: string[]) {
  navigator.clipboard.writeText(codes.join('\n'))
  toast.success(t('common.copied'))
}

function downloadBackupCodes(codes: string[]) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

// --- Devices ---
async function fetchDevices() {
  try {
    devicesLoading.value = true
    const data = await $fetch<any>('/api/auth/device/list')
    devices.value = Array.isArray(data) ? data : (data.devices || [])
  } catch {
    devices.value = []
  } finally {
    devicesLoading.value = false
  }
}

async function addCurrentDevice() {
  try {
    addDeviceLoading.value = true
    const { getDeviceId, getDeviceName, getFingerprint } = useDeviceAuth()
    await $fetch('/api/auth/device/register', {
      method: 'POST',
      body: { deviceId: getDeviceId(), deviceName: getDeviceName(), deviceFingerprint: getFingerprint() },
    })
    toast.success(t('security.device.added'))
    await fetchDevices()
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  } finally {
    addDeviceLoading.value = false
  }
}

async function removeDevice(id: number) {
  if (!confirm(t('security.device.removeConfirm'))) return
  try {
    await $fetch(`/api/auth/device/${id}`, { method: 'DELETE' })
    toast.success(t('security.device.removed'))
    await fetchDevices()
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  }
}

// --- Passkeys ---
async function fetchPasskeys() {
  try {
    passkeysLoading.value = true
    const data = await $fetch<any>('/api/auth/passkey/list')
    passkeys.value = Array.isArray(data) ? data : (data.passkeys || [])
  } catch {
    passkeys.value = []
  } finally {
    passkeysLoading.value = false
  }
}

async function registerPasskey() {
  if (!passkeyName.value.trim()) return
  try {
    passkeyRegistering.value = true
    // 1. Get registration options
    const options = await $fetch<any>('/api/auth/passkey/register-options', { method: 'POST' })
    // 2. Trigger browser WebAuthn
    const { startRegistration } = await import('@simplewebauthn/browser')
    const regResp = await startRegistration({ optionsJSON: options })
    // 3. Verify
    await $fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      body: { response: regResp, name: passkeyName.value.trim() },
    })
    toast.success(t('security.passkey.added'))
    showAddPasskey.value = false
    passkeyName.value = ''
    await fetchPasskeys()
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || e?.message || t('common.failed'))
  } finally {
    passkeyRegistering.value = false
  }
}

async function removePasskey(id: number) {
  if (!confirm(t('security.passkey.removeConfirm'))) return
  try {
    await $fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' })
    toast.success(t('security.passkey.removed'))
    await fetchPasskeys()
    await fetchMethods()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || t('common.failed'))
  }
}

function truncateUA(ua: string, len = 60) {
  return ua && ua.length > len ? ua.substring(0, len) + '...' : ua
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString()
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-800">{{ t('security.title') }}</h1>
      <p class="text-sm text-gray-500 mt-1">{{ t('security.subtitle') }}</p>
    </div>

    <!-- Section 1: TOTP -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
              <Icon name="material-symbols:security" class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-800">{{ t('security.totp.title') }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">{{ t('security.totp.desc') }}</p>
            </div>
          </div>
          <span
            v-if="!loadingMethods"
            :class="[
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
              methods?.totp
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-500 border border-gray-200',
            ]"
          >
            {{ methods?.totp ? t('security.totp.enabled') : t('security.totp.disabled') }}
          </span>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <template v-if="!methods?.totp">
            <button
              :disabled="setupLoading"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-60"
              @click="startTOTPSetup"
            >
              <Icon v-if="setupLoading" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin" />
              <Icon v-else name="material-symbols:add" class="w-4 h-4" />
              {{ t('security.totp.enable') }}
            </button>
          </template>
          <template v-else>
            <button
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
              @click="showDisableConfirm = true"
            >
              <Icon name="material-symbols:close" class="w-4 h-4" />
              {{ t('security.totp.disable') }}
            </button>
            <button
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              @click="showBackupCodesModal = true; backupCodesData = null; backupCodesPassword = ''"
            >
              <Icon name="material-symbols:key" class="w-4 h-4" />
              {{ t('security.totp.regenerate') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Section 2: Authorized Devices -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50">
              <Icon name="material-symbols:devices" class="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-800">{{ t('security.device.title') }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">{{ t('security.device.desc') }}</p>
            </div>
          </div>
          <span v-if="!loadingMethods" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
            {{ t('security.device.count', { n: methods?.deviceCount || 0 }) }}
          </span>
        </div>

        <!-- Device list -->
        <div class="mt-5 space-y-3">
          <div v-if="devicesLoading" class="flex items-center justify-center py-8 text-gray-400">
            <Icon name="material-symbols:progress-activity" class="w-5 h-5 animate-spin" />
          </div>

          <div v-else-if="devices.length === 0" class="text-center py-8 text-sm text-gray-400">
            {{ t('security.device.noDevices') }}
          </div>

          <div
            v-for="device in devices"
            :key="device.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 shrink-0">
                <Icon name="material-symbols:smartphone" class="w-4 h-4 text-gray-600" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-800 truncate">{{ device.name || 'Device' }}</span>
                  <span v-if="device.isCurrent" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {{ t('security.device.current') }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 truncate">{{ truncateUA(device.userAgent || '') }}</p>
                <p class="text-xs text-gray-400">
                  {{ t('security.device.lastUsed') }}: {{ formatDate(device.lastUsed || device.last_used) }}
                </p>
              </div>
            </div>
            <button
              class="shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
              @click="removeDevice(device.id)"
            >
              {{ t('security.device.remove') }}
            </button>
          </div>
        </div>

        <div class="mt-4">
          <button
            :disabled="addDeviceLoading || (methods?.deviceCount >= 10)"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-60"
            @click="addCurrentDevice"
          >
            <Icon v-if="addDeviceLoading" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin" />
            <Icon v-else name="material-symbols:add" class="w-4 h-4" />
            {{ t('security.device.addCurrent') }}
          </button>
          <p v-if="methods?.deviceCount >= 10" class="text-xs text-amber-600 mt-2">
            {{ t('security.device.maxReached') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Section 3: Passkeys -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50">
              <Icon name="material-symbols:fingerprint" class="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-800">{{ t('security.passkey.title') }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">{{ t('security.passkey.desc') }}</p>
            </div>
          </div>
          <span v-if="!loadingMethods" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
            {{ methods?.passkeyCount || 0 }}
          </span>
        </div>

        <!-- Not supported -->
        <div v-if="!webAuthnSupported" class="mt-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <Icon name="material-symbols:warning-outline" class="w-5 h-5 shrink-0" />
          {{ t('security.passkey.notSupported') }}
        </div>

        <!-- Passkey list -->
        <div v-else class="mt-5 space-y-3">
          <div v-if="passkeysLoading" class="flex items-center justify-center py-8 text-gray-400">
            <Icon name="material-symbols:progress-activity" class="w-5 h-5 animate-spin" />
          </div>

          <div v-else-if="passkeys.length === 0" class="text-center py-8 text-sm text-gray-400">
            {{ t('security.passkey.noPasskeys') }}
          </div>

          <div
            v-for="pk in passkeys"
            :key="pk.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 shrink-0">
                <Icon name="material-symbols:passkey" class="w-4 h-4 text-amber-700" />
              </div>
              <div class="min-w-0">
                <span class="text-sm font-medium text-gray-800">{{ pk.name || 'Passkey' }}</span>
                <p class="text-xs text-gray-400">
                  {{ t('security.passkey.lastUsed') }}: {{ formatDate(pk.lastUsed || pk.last_used) }}
                </p>
                <p class="text-xs text-gray-400">
                  {{ formatDate(pk.createdAt || pk.created_at) }}
                </p>
              </div>
            </div>
            <button
              class="shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
              @click="removePasskey(pk.id)"
            >
              {{ t('security.passkey.remove') }}
            </button>
          </div>

          <!-- Add Passkey -->
          <div class="mt-4">
            <Transition name="slide-down">
              <div v-if="showAddPasskey" class="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                <label class="block text-sm font-medium text-gray-700">
                  {{ t('security.passkey.nameLabel') }}
                </label>
                <input
                  v-model="passkeyName"
                  type="text"
                  :placeholder="t('security.passkey.namePlaceholder')"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <div class="flex gap-2">
                  <button
                    :disabled="passkeyRegistering || !passkeyName.trim()"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-60"
                    @click="registerPasskey"
                  >
                    <Icon v-if="passkeyRegistering" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin" />
                    {{ passkeyRegistering ? t('security.passkey.registering') : t('security.passkey.register') }}
                  </button>
                  <button
                    class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    @click="showAddPasskey = false; passkeyName = ''"
                  >
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </div>
            </Transition>

            <button
              v-if="!showAddPasskey"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors"
              @click="showAddPasskey = true"
            >
              <Icon name="material-symbols:add" class="w-4 h-4" />
              {{ t('security.passkey.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TOTP Setup Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSetupModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showSetupModal = false" />
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <!-- QR step -->
            <template v-if="setupStep === 'qr'">
              <h3 class="text-lg font-semibold text-gray-800 mb-1">{{ t('security.totp.setupTitle') }}</h3>
              <p class="text-sm text-gray-500 mb-5">{{ t('security.totp.step1') }}</p>

              <!-- QR Code -->
              <div v-if="setupData" class="flex flex-col items-center mb-5">
                <img :src="setupData.qrCodeDataUrl" alt="QR Code" class="w-48 h-48 rounded-lg border border-gray-200" />
                <div class="mt-3 w-full">
                  <label class="block text-xs text-gray-500 mb-1">{{ t('security.totp.manualKey') }}</label>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all select-all">
                      {{ setupData.secret }}
                    </code>
                    <button
                      class="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      @click="navigator.clipboard.writeText(setupData!.secret); toast.success(t('common.copied'))"
                    >
                      <Icon name="material-symbols:content-copy" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Verify Code -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('security.totp.step2') }}</label>
                <input
                  v-model="setupCode"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="000000"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 text-center text-xl font-mono tracking-[0.3em] text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div class="flex gap-3">
                <button
                  :disabled="setupLoading || setupCode.length !== 6"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-60"
                  @click="confirmTOTPSetup"
                >
                  <Icon v-if="setupLoading" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin" />
                  {{ t('security.totp.verifyCode') }}
                </button>
                <button
                  class="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  @click="showSetupModal = false"
                >
                  {{ t('common.cancel') }}
                </button>
              </div>
            </template>

            <!-- Backup codes step -->
            <template v-if="setupStep === 'backup' && setupData">
              <h3 class="text-lg font-semibold text-gray-800 mb-1">{{ t('security.totp.backupCodes') }}</h3>
              <p class="text-sm text-gray-500 mb-5">{{ t('security.totp.backupCodesDesc') }}</p>

              <div class="grid grid-cols-2 gap-2 mb-5">
                <div
                  v-for="code in setupData.backupCodes"
                  :key="code"
                  class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-mono text-sm text-gray-700 select-all"
                >
                  {{ code }}
                </div>
              </div>

              <div class="flex gap-3 mb-4">
                <button
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                  @click="copyBackupCodes(setupData!.backupCodes)"
                >
                  <Icon name="material-symbols:content-copy" class="w-4 h-4" />
                  {{ t('security.totp.copyAll') }}
                </button>
                <button
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                  @click="downloadBackupCodes(setupData!.backupCodes)"
                >
                  <Icon name="material-symbols:download" class="w-4 h-4" />
                  Download
                </button>
              </div>

              <button
                class="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                @click="showSetupModal = false"
              >
                {{ t('common.close') }}
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Disable TOTP Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDisableConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showDisableConfirm = false" />
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ t('security.totp.disable') }}</h3>
            <p class="text-sm text-gray-500 mb-4">{{ t('security.totp.disableConfirm') }}</p>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('security.totp.enterPassword') }}</label>
              <input
                v-model="disablePassword"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div class="flex gap-3">
              <button
                :disabled="disableLoading || !disablePassword"
                class="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-60"
                @click="disableTOTP"
              >
                <Icon v-if="disableLoading" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin inline mr-1" />
                {{ t('common.confirm') }}
              </button>
              <button
                class="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                @click="showDisableConfirm = false; disablePassword = ''"
              >
                {{ t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Backup Codes Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showBackupCodesModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showBackupCodesModal = false" />
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ t('security.totp.backupCodes') }}</h3>

            <!-- Password prompt (if no codes yet) -->
            <template v-if="!backupCodesData">
              <p class="text-sm text-gray-500 mb-4">{{ t('security.totp.enterPassword') }}</p>
              <div class="mb-4">
                <input
                  v-model="backupCodesPassword"
                  type="password"
                  :placeholder="t('auth.password')"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
              <div class="flex gap-3">
                <button
                  :disabled="backupCodesLoading || !backupCodesPassword"
                  class="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-60"
                  @click="regenerateBackupCodes"
                >
                  <Icon v-if="backupCodesLoading" name="material-symbols:progress-activity" class="w-4 h-4 animate-spin inline mr-1" />
                  {{ t('security.totp.regenerate') }}
                </button>
                <button
                  class="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  @click="showBackupCodesModal = false"
                >
                  {{ t('common.cancel') }}
                </button>
              </div>
            </template>

            <!-- Show codes -->
            <template v-else>
              <p class="text-sm text-gray-500 mb-4">{{ t('security.totp.backupCodesDesc') }}</p>
              <div class="grid grid-cols-2 gap-2 mb-5">
                <div
                  v-for="code in backupCodesData"
                  :key="code"
                  class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-mono text-sm text-gray-700 select-all"
                >
                  {{ code }}
                </div>
              </div>
              <div class="flex gap-3 mb-4">
                <button
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                  @click="copyBackupCodes(backupCodesData!)"
                >
                  <Icon name="material-symbols:content-copy" class="w-4 h-4" />
                  {{ t('security.totp.copyAll') }}
                </button>
                <button
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                  @click="downloadBackupCodes(backupCodesData!)"
                >
                  <Icon name="material-symbols:download" class="w-4 h-4" />
                  Download
                </button>
              </div>
              <button
                class="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                @click="showBackupCodesModal = false"
              >
                {{ t('common.close') }}
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
