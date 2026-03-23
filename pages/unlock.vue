<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const { t } = useI18n()

const mode = ref<'login' | 'create'>('login')
const password = ref('')
const confirmPassword = ref('')
const accountName = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const error = ref('')
const isReady = ref(false)

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
    await authStore.unlock(password.value)
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || t('auth.errors.loginFailed')
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
