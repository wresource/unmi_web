<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t } = useI18n()

useHead({
  title: computed(() => `${t('show.inquiry.title')} - UNMI.IO`),
})

const route = useRoute()

const form = reactive({
  name: '',
  email: '',
  phone: '',
  wechat: '',
  company: '',
  domain_name: (route.query.domain as string) || '',
  budget: '',
  message: '',
})

const loading = ref(false)
const submitted = ref(false)
const error = ref('')

async function submit() {
  if (!form.name || !form.email || !form.domain_name) {
    error.value = t('show.inquiry.requiredFieldsError')
    return
  }

  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/show/inquiry', {
      method: 'POST',
      body: { ...form },
    })
    submitted.value = true
  } catch (e: any) {
    error.value = e?.data?.message || t('show.inquiry.submitError')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  submitted.value = false
  error.value = ''
  Object.assign(form, {
    name: '',
    email: '',
    phone: '',
    wechat: '',
    company: '',
    domain_name: '',
    budget: '',
    message: '',
  })
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen py-12 sm:py-20">
    <div class="max-w-2xl mx-auto px-4 sm:px-6">
      <!-- Success state -->
      <div v-if="submitted" class="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
        <div class="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <Icon name="material-symbols:check-circle" class="h-8 w-8 text-green-600" />
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-3">{{ t('show.inquiry.successTitle') }}</h2>
        <p class="text-gray-500 mb-8">
          {{ t('show.inquiry.successMsg') }}
        </p>
        <div class="flex items-center justify-center gap-4">
          <NuxtLink
            to="/show/domains"
            class="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {{ t('show.market.title') }}
          </NuxtLink>
          <button
            class="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            @click="resetForm"
          >
            {{ t('show.inquiry.submitAnother') }}
          </button>
        </div>
      </div>

      <!-- Form -->
      <template v-else>
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-3">{{ t('show.inquiry.title') }}</h1>
          <p class="text-gray-500">{{ t('show.inquiry.subtitle') }}</p>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <form class="space-y-5" @submit.prevent="submit">
            <div v-if="error" class="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
              {{ error }}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                {{ t('show.inquiry.interestedDomain') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.domain_name"
                type="text"
                class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                :placeholder="t('show.inquiry.domainExample')"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  {{ t('show.inquiry.name') }} <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                  :placeholder="t('show.inquiry.namePlaceholder')"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  {{ t('show.inquiry.email') }} <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.email"
                  type="email"
                  class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                  :placeholder="t('show.inquiry.emailPlaceholder')"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('show.inquiry.phone') }}</label>
                <input
                  v-model="form.phone"
                  type="tel"
                  class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                  :placeholder="t('show.inquiry.phonePlaceholder')"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('show.inquiry.wechatLabel') }}</label>
                <input
                  v-model="form.wechat"
                  type="text"
                  class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                  :placeholder="t('show.inquiry.wechatPlaceholder')"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('show.inquiry.company') }}</label>
              <input
                v-model="form.company"
                type="text"
                class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                :placeholder="t('show.inquiry.companyPlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('show.inquiry.budgetLabel') }}</label>
              <input
                v-model="form.budget"
                type="text"
                class="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm input-focus"
                :placeholder="t('show.inquiry.budgetExample')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('show.inquiry.message') }}</label>
              <textarea
                v-model="form.message"
                rows="4"
                class="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm input-focus resize-none"
                :placeholder="t('show.inquiry.messagePlaceholder')"
              />
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {{ loading ? t('show.inquiry.submitting') : t('show.inquiry.submitBtn') }}
            </button>

            <p class="text-xs text-gray-400 text-center">
              {{ t('show.footer.privacy') }} &middot; {{ t('show.footer.terms') }}
            </p>
          </form>
        </div>
      </template>
    </div>
  </div>
</template>
