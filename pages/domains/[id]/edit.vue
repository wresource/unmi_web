<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const domainId = computed(() => Number(route.params.id))

const pageLoading = ref(true)
const loading = ref(false)
const tags = ref<any[]>([])
const originalDomain = ref<any>(null)

// Form data
const form = reactive({
  domain_name: '',
  registrar: '',
  status: 'active',
  usage_type: '',
  registration_date: '',
  expiry_date: '',
  auto_renew: false,
  purchase_price: 0,
  renewal_price: 0,
  hold_cost: 0,
  currency: 'CNY',
  dns_servers: '',
  privacy_protection: false,
  tag_ids: [] as number[],
  memo: '',
})

// Validation
const errors = reactive<Record<string, string>>({})

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k])

  if (!form.domain_name.trim()) {
    errors.domain_name = t('domains.form.domainRequired')
  } else {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(form.domain_name.trim())) {
      errors.domain_name = t('domains.form.domainInvalid')
    }
  }

  if (!form.expiry_date) {
    errors.expiry_date = t('domains.form.expiryRequired')
  }

  return Object.keys(errors).length === 0
}

// Auto-extract TLD
const extractedTld = computed(() => {
  const name = form.domain_name.trim()
  if (!name) return ''
  const parts = name.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(1).join('.')
  }
  return ''
})

const statusOptions = computed(() => [
  { value: 'active', label: t('domains.status.active') },
  { value: 'expired', label: t('domains.status.expired') },
  { value: 'transferring', label: t('domains.status.transferring') },
  { value: 'pending_delete', label: t('domains.status.pending_delete') },
  { value: 'redemption', label: t('domains.status.redemption') },
  { value: 'reserved', label: t('domains.status.reserved') },
])

const currencyOptions = [
  { value: 'CNY', label: 'CNY (人民币)' },
  { value: 'USD', label: 'USD (美元)' },
]

// Fetch data
async function fetchData() {
  pageLoading.value = true
  try {
    const [domainRes, tagsRes] = await Promise.all([
      $fetch<any>(`/api/domains/${domainId.value}`),
      $fetch<any>('/api/tags'),
    ])

    originalDomain.value = domainRes.data
    tags.value = tagsRes.data || []

    // Populate form
    const d = domainRes.data
    form.domain_name = d.domain_name || ''
    form.registrar = d.registrar || ''
    form.status = d.status || 'active'
    form.registration_date = d.registration_date ? d.registration_date.slice(0, 10) : ''
    form.expiry_date = d.expiry_date ? d.expiry_date.slice(0, 10) : ''
    form.auto_renew = !!d.auto_renew
    form.purchase_price = d.purchase_price || 0
    form.renewal_price = d.renewal_price || 0
    form.hold_cost = d.hold_cost || 0
    form.dns_servers = d.dns_servers || ''
    form.memo = d.memo || ''
    form.tag_ids = (d.tags || []).map((tg: any) => tg.id)
  } catch (err: any) {
    toast.error(t('domains.form.fetchFailed') + ': ' + (err.data?.statusMessage || err.message))
    router.push('/domains')
  } finally {
    pageLoading.value = false
  }
}

// Toggle tag
function toggleTag(tagId: number) {
  const idx = form.tag_ids.indexOf(tagId)
  if (idx > -1) {
    form.tag_ids.splice(idx, 1)
  } else {
    form.tag_ids.push(tagId)
  }
}

// Submit
async function submit() {
  if (!validate()) return

  loading.value = true
  try {
    await $fetch(`/api/domains/${domainId.value}`, {
      method: 'PUT',
      body: {
        domain_name: form.domain_name.trim().toLowerCase(),
        registrar: form.registrar,
        status: form.status,
        registration_date: form.registration_date || null,
        expiry_date: form.expiry_date || null,
        auto_renew: form.auto_renew,
        purchase_price: form.purchase_price || 0,
        renewal_price: form.renewal_price || 0,
        is_held: form.hold_cost > 0,
        hold_cost: form.hold_cost || 0,
        dns_servers: form.dns_servers,
        tag_ids: form.tag_ids,
        memo: form.memo,
      },
    })

    toast.success(t('domains.form.updateSuccess'))
    router.push(`/domains/${domainId.value}`)
  } catch (err: any) {
    const msg = err.data?.statusMessage || err.message || t('domains.form.updateFailed')
    toast.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Loading -->
    <div v-if="pageLoading" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-500">{{ t('common.loading') }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          @click="router.back()"
        >
          <Icon name="heroicons:arrow-left" class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ t('domains.editDomain') }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">{{ originalDomain?.domain_name }}</p>
        </div>
      </div>

      <form @submit.prevent="submit" class="space-y-6">
        <!-- Basic info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.form.basicInfo') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('domains.domainName') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.domain_name"
                type="text"
                placeholder="example.com"
                class="w-full px-3 py-2 text-sm border rounded-lg input-focus"
                :class="errors.domain_name ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-300'"
              />
              <div class="flex items-center justify-between mt-1">
                <p v-if="errors.domain_name" class="text-xs text-red-500">{{ errors.domain_name }}</p>
                <p v-if="extractedTld" class="text-xs text-gray-400 ml-auto">TLD: {{ extractedTld }}</p>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.registrar') }}</label>
              <input
                v-model="form.registrar"
                type="text"
                :placeholder="t('domains.form.registrarPlaceholder')"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.status') }}</label>
              <select
                v-model="form.status"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              >
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.usageType') }}</label>
              <input
                v-model="form.usage_type"
                type="text"
                :placeholder="t('domains.form.usagePlaceholder')"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
          </div>
        </div>

        <!-- Time info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.form.timeInfo') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.regDate') }}</label>
              <input
                v-model="form.registration_date"
                type="date"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ t('domains.expiryDate') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.expiry_date"
                type="date"
                class="w-full px-3 py-2 text-sm border rounded-lg input-focus"
                :class="errors.expiry_date ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-300'"
              />
              <p v-if="errors.expiry_date" class="text-xs text-red-500 mt-1">{{ errors.expiry_date }}</p>
            </div>
            <div class="flex items-center gap-3 sm:col-span-2">
              <button
                type="button"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
                :class="form.auto_renew ? 'bg-primary-600' : 'bg-gray-200'"
                @click="form.auto_renew = !form.auto_renew"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="form.auto_renew ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
              <label class="text-sm font-medium text-gray-700">{{ t('domains.form.autoRenew') }}</label>
            </div>
          </div>
        </div>

        <!-- Cost info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.form.costInfo') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.purchasePrice') }}</label>
              <input
                v-model.number="form.purchase_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.renewalPrice') }}</label>
              <input
                v-model.number="form.renewal_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.holdCost') }}</label>
              <input
                v-model.number="form.hold_cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.currency') }}</label>
              <select
                v-model="form.currency"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              >
                <option v-for="c in currencyOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Extended info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.form.extendedInfo') }}</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.form.dnsProvider') }}</label>
              <input
                v-model="form.dns_servers"
                type="text"
                :placeholder="t('domains.form.dnsPlaceholder')"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
              />
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
                :class="form.privacy_protection ? 'bg-primary-600' : 'bg-gray-200'"
                @click="form.privacy_protection = !form.privacy_protection"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="form.privacy_protection ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
              <label class="text-sm font-medium text-gray-700">{{ t('domains.form.privacyProtection') }}</label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ t('domains.tags') }}</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tg in tags"
                  :key="tg.id"
                  type="button"
                  class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  :class="form.tag_ids.includes(tg.id)
                    ? 'border-transparent text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                  :style="form.tag_ids.includes(tg.id) ? { backgroundColor: tg.color } : {}"
                  @click="toggleTag(tg.id)"
                >
                  {{ tg.name }}
                </button>
                <span v-if="tags.length === 0" class="text-sm text-gray-400">{{ t('domains.form.noTagsAvailable') }}</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.notes') }}</label>
              <textarea
                v-model="form.memo"
                rows="3"
                :placeholder="t('domains.form.notePlaceholder')"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus resize-none"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pb-6">
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            @click="router.push(`/domains/${domainId}`)"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            :disabled="loading"
          >
            <span v-if="loading" class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ t('common.saving') }}
            </span>
            <span v-else>{{ t('domains.form.saveChanges') }}</span>
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
