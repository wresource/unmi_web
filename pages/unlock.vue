<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const { t } = useI18n()
const { getStoredDeviceId } = useDeviceAuth()

const mode = ref<'login' | 'create'>('login')
const password = ref('')
const confirmPassword = ref('')
const accountName = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const error = ref('')
const isReady = ref(false)

// TOTP state
const totpCode = ref('')
const useBackup = ref(false)
const backupCode = ref('')
const totpError = ref('')
const totpLoading = ref(false)

// Passkey state
const webAuthnSupported = ref(false)
const passkeyLoading = ref(false)

// Store password for TOTP re-submission
const savedPassword = ref('')

// Check status on both server and client
const { data: statusData } = await useFetch('/api/auth/status')
if (statusData.value) {
  authStore.initialized = statusData.value.initialized
  // If no accounts exist, default to create mode
  if (!statusData.value.initialized) {
    mode.value = 'create'
  }
}
isReady.value = true

// Check WebAuthn support
onMounted(() => {
  webAuthnSupported.value = !!(window.PublicKeyCredential)
})

function switchMode(m: 'login' | 'create') {
  mode.value = m
  error.value = ''
  password.value = ''
  confirmPassword.value = ''
  accountName.value = ''
}

async function handleLogin() {
  error.value = ''
  if (!password.value) {
    error.value = t('auth.errors.passwordRequired')
    return
  }
  try {
    savedPassword.value = password.value
    const deviceId = getStoredDeviceId() || undefined
    const result = await authStore.unlock(password.value, undefined, undefined, deviceId)
    if (result?.requiresTOTP) {
      // TOTP step will be shown via pendingTOTP
      return
    }
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || t('auth.errors.loginFailed')
  }
}

async function handleTOTPSubmit() {
  totpError.value = ''
  const code = useBackup.value ? backupCode.value.trim() : totpCode.value.trim()
  if (!code) {
    totpError.value = useBackup.value ? t('auth.backupCodeInvalid') : t('auth.totpInvalid')
    return
  }
  try {
    totpLoading.value = true
    const deviceId = getStoredDeviceId() || undefined
    if (useBackup.value) {
      await authStore.unlock(savedPassword.value, undefined, code, deviceId)
    } else {
      await authStore.unlock(savedPassword.value, code, undefined, deviceId)
    }
    navigateTo('/dashboard')
  } catch (e: any) {
    totpError.value = e.message || (useBackup.value ? t('auth.backupCodeInvalid') : t('auth.totpInvalid'))
  } finally {
    totpLoading.value = false
  }
}

function handleCancelTOTP() {
  authStore.cancelTOTP()
  totpCode.value = ''
  backupCode.value = ''
  totpError.value = ''
  useBackup.value = false
  savedPassword.value = ''
}

async function handlePasskeyLogin() {
  try {
    passkeyLoading.value = true
    error.value = ''
    await authStore.loginWithPasskey()
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || t('auth.passkeyFailed')
  } finally {
    passkeyLoading.value = false
  }
}

async function handleCreate() {
  error.value = ''
  if (!password.value) {
    error.value = t('auth.errors.passwordRequired')
    return
  }
  if (password.value.length < 6) {
    error.value = t('auth.errors.passwordMinLength')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errors.passwordMismatch')
    return
  }
  try {
    await authStore.createAccount(password.value, confirmPassword.value, accountName.value || undefined)
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || t('auth.errors.createFailed')
  }
}

function handleSubmit() {
  if (mode.value === 'create') {
    handleCreate()
  } else {
    handleLogin()
  }
}
</script>

<template>
  <Transition name="fade" appear>
    <div v-if="isReady">
      <!-- TOTP Verification Step -->
      <Transition name="fade" mode="out-in">
        <div v-if="authStore.pendingTOTP" key="totp">
          <div class="bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-6 sm:p-8">
            <!-- TOTP Header -->
            <div class="text-center mb-6">
              <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/15 mb-4">
                <Icon name="material-symbols:security" class="w-7 h-7 text-blue-400" />
              </div>
              <h2 class="text-lg font-semibold text-white mb-1">{{ t('auth.totpTitle') }}</h2>
              <p class="text-sm text-gray-400">
                {{ useBackup ? t('auth.useBackupCode') : t('auth.totpSubtitle') }}
              </p>
            </div>

            <!-- TOTP Error -->
            <Transition name="slide-down">
              <div
                v-if="totpError"
                class="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <Icon name="material-symbols:error-outline" class="w-5 h-5 flex-shrink-0" />
                <span>{{ totpError }}</span>
              </div>
            </Transition>

            <form @submit.prevent="handleTOTPSubmit" class="space-y-5">
              <!-- Toggle: TOTP code vs Backup code -->
              <div v-if="!useBackup">
                <label class="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {{ t('auth.totpCode') }}
                </label>
                <input
                  v-model="totpCode"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  :placeholder="t('auth.totpCodePlaceholder')"
                  class="w-full px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder-gray-600 outline-none transition-all duration-150 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                />
              </div>

              <div v-else>
                <label class="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {{ t('auth.useBackupCode') }}
                </label>
                <input
                  v-model="backupCode"
                  type="text"
                  maxlength="9"
                  :placeholder="t('auth.backupCodePlaceholder')"
                  class="w-full px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white text-center text-xl font-mono tracking-widest placeholder-gray-600 outline-none transition-all duration-150 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                />
              </div>

              <!-- Toggle button -->
              <button
                type="button"
                class="w-full text-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                @click="useBackup = !useBackup; totpError = ''"
              >
                {{ useBackup ? t('auth.totpSubtitle') : t('auth.useBackupCode') }}
              </button>

              <!-- Submit -->
              <button
                type="submit"
                :disabled="totpLoading"
                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Icon
                  v-if="totpLoading"
                  name="material-symbols:progress-activity"
                  class="w-5 h-5 animate-spin"
                />
                <Icon v-else name="material-symbols:check" class="w-5 h-5" />
                {{ totpLoading ? t('auth.verifying') : t('auth.loginBtn') }}
              </button>

              <!-- Cancel -->
              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                @click="handleCancelTOTP"
              >
                <Icon name="material-symbols:arrow-back" class="w-4 h-4" />
                {{ t('auth.cancelTotp') }}
              </button>
            </form>
          </div>
        </div>

        <!-- Normal Login / Create -->
        <div v-else key="login">
          <!-- Tab switcher -->
          <div class="flex justify-center mb-6">
            <div class="inline-flex rounded-full bg-white/5 border border-white/10 p-1">
              <button
                :class="[
                  'px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white',
                ]"
                @click="switchMode('login')"
              >
                {{ t('auth.login') }}
              </button>
              <button
                :class="[
                  'px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                  mode === 'create'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white',
                ]"
                @click="switchMode('create')"
              >
                {{ t('auth.createAccount') }}
              </button>
            </div>
          </div>

          <!-- Main Card -->
          <div class="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8">
            <!-- Subtitle -->
            <p class="text-center text-sm text-gray-400 mb-5">
              {{ mode === 'login' ? t('auth.loginSubtitle') : t('auth.createSubtitle') }}
            </p>

            <!-- Error Message -->
            <Transition name="slide-down">
              <div
                v-if="error"
                class="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <Icon name="material-symbols:error-outline" class="w-5 h-5 flex-shrink-0" />
                <span>{{ error }}</span>
              </div>
            </Transition>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="space-y-4">
              <!-- Account Name (create mode only) -->
              <Transition name="slide-down">
                <div v-if="mode === 'create'">
                  <label class="block text-sm font-medium text-gray-300 mb-1.5">
                    {{ t('auth.accountName') }} <span class="text-gray-500 text-xs">{{ t('auth.optional') }}</span>
                  </label>
                  <input
                    v-model="accountName"
                    type="text"
                    :placeholder="t('auth.accountNamePlaceholder')"
                    class="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                  />
                </div>
              </Transition>

              <!-- Password Field -->
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1.5">
                  {{ t('auth.password') }}
                </label>
                <div class="relative">
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="mode === 'login' ? t('auth.loginPlaceholder') : t('auth.createPlaceholder')"
                    class="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    @click="showPassword = !showPassword"
                  >
                    <Icon
                      :name="showPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'"
                      class="w-5 h-5"
                    />
                  </button>
                </div>
              </div>

              <!-- Confirm Password (Create mode) -->
              <Transition name="slide-down">
                <div v-if="mode === 'create'">
                  <label class="block text-sm font-medium text-gray-300 mb-1.5">
                    {{ t('auth.confirmPassword') }}
                  </label>
                  <div class="relative">
                    <input
                      v-model="confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      :placeholder="t('auth.confirmPlaceholder')"
                      class="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                      autocomplete="new-password"
                    />
                    <button
                      type="button"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <Icon
                        :name="showConfirmPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'"
                        class="w-5 h-5"
                      />
                    </button>
                  </div>
                </div>
              </Transition>

              <!-- Submit Button -->
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-6"
                :class="mode === 'create'
                  ? 'bg-green-600 hover:bg-green-500 shadow-green-600/25 hover:shadow-green-500/40'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25 hover:shadow-blue-500/40'"
              >
                <Icon
                  v-if="authStore.loading"
                  name="material-symbols:progress-activity"
                  class="w-5 h-5 animate-spin"
                />
                <Icon
                  v-else
                  :name="mode === 'create' ? 'material-symbols:person-add-outline' : 'material-symbols:lock-open-outline'"
                  class="w-5 h-5"
                />
                {{ mode === 'create' ? t('auth.createBtn') : t('auth.loginBtn') }}
              </button>
            </form>

            <!-- Passkey divider and button (login mode only) -->
            <Transition name="slide-down">
              <div v-if="mode === 'login' && webAuthnSupported" class="mt-6">
                <!-- Divider -->
                <div class="flex items-center gap-3 mb-4">
                  <div class="flex-1 h-px bg-white/10" />
                  <span class="text-xs text-gray-500">{{ t('auth.orDivider') }}</span>
                  <div class="flex-1 h-px bg-white/10" />
                </div>

                <!-- Passkey button -->
                <button
                  type="button"
                  :disabled="passkeyLoading"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  @click="handlePasskeyLogin"
                >
                  <Icon
                    v-if="passkeyLoading"
                    name="material-symbols:progress-activity"
                    class="w-5 h-5 animate-spin"
                  />
                  <Icon v-else name="material-symbols:fingerprint" class="w-5 h-5" />
                  {{ t('auth.loginWithPasskey') }}
                </button>
              </div>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="mt-6 text-center space-y-2">
            <div class="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="material-symbols:encrypted" class="w-3.5 h-3.5" />
              <span>{{ t('auth.securityNote') }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
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
