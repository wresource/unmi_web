<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const loading = ref(false)
const autoDetecting = ref(false)
const autoDetectSource = ref<string | null>(null)
const tags = ref<any[]>([])
const pricingData = ref<any>(null)
const appraisalData = ref<any>(null)

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
  // Clear
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

// Status options
const statusOptions = computed(() => [
  { value: 'active', label: t('domains.status.active') },
  { value: 'expired', label: t('domains.status.expired') },
  { value: 'transferring', label: t('domains.status.transferring') },
  { value: 'pending_delete', label: t('domains.status.pending_delete') },
  { value: 'redemption', label: t('domains.status.redemption') },
  { value: 'reserved', label: t('domains.status.reserved') },
])

const currencyOptions = computed(() => [
  { value: 'CNY', label: t('domains.form.currencyCNY') },
  { value: 'USD', label: t('domains.form.currencyUSD') },
])

// Auto-detect domain info via WHOIS
async function autoDetect() {
  const domain = form.domain_name.trim()
  if (!domain) {
    toast.warning(t('domains.form.enterDomainFirst'))
    return
  }

  autoDetecting.value = true
  autoDetectSource.value = null

  try {
    const res = await $fetch<any>('/api/whois/autofill', {
      method: 'POST',
      body: { domain },
    })

    if (res.success && res.data) {
      if (res.data.registrar) form.registrar = res.data.registrar
      if (res.data.registration_date) form.registration_date = res.data.registration_date
      if (res.data.expiry_date) form.expiry_date = res.data.expiry_date
      if (res.data.dns_servers) form.dns_servers = res.data.dns_servers
      if (res.data.status) form.status = res.data.status
      // Fill pricing data
      if (res.data.renewal_price) form.renewal_price = res.data.renewal_price
      if (res.data.purchase_price) form.purchase_price = res.data.purchase_price
      if (res.data.currency) form.currency = res.data.currency
      // Store pricing comparison data
      if (res.pricing) pricingData.value = res.pricing
      if (res.appraisal) appraisalData.value = res.appraisal
      autoDetectSource.value = res.whois?.source || null
      toast.success(t('domains.form.autoDetectSuccess'))
    } else {
      toast.error(res.error || t('common.failed'))
    }
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || t('common.failed')
    toast.error(msg)
  } finally {
    autoDetecting.value = false
  }
}

// Fetch tags
async function fetchTags() {
  try {
    const res = await $fetch<any>('/api/tags')
    tags.value = res.data || []
  } catch {
    // silently fail
  }
}

// Toggle tag selection
function toggleTag(tagId: number) {
  const idx = form.tag_ids.indexOf(tagId)
  if (idx > -1) {
    form.tag_ids.splice(idx, 1)
  } else {
    form.tag_ids.push(tagId)
  }
}

// Submit
async function submit(continueAdding = false) {
  if (!validate()) return

  loading.value = true
  try {
    await $fetch('/api/domains', {
      method: 'POST',
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

    toast.success(t('domains.domainAdded'))

    if (continueAdding) {
      // Reset form
      form.domain_name = ''
      form.registrar = ''
      form.status = 'active'
      form.usage_type = ''
      form.registration_date = ''
      form.expiry_date = ''
      form.auto_renew = false
      form.purchase_price = 0
      form.renewal_price = 0
      form.hold_cost = 0
      form.dns_servers = ''
      form.privacy_protection = false
      form.tag_ids = []
      form.memo = ''
      autoDetectSource.value = null
      pricingData.value = null
      appraisalData.value = null
      Object.keys(errors).forEach((k) => delete errors[k])
    } else {
      router.push('/domains')
    }
  } catch (err: any) {
    const msg = err.data?.statusMessage || err.message || t('common.failed')
    toast.error(msg)
  } finally {
    loading.value = false
  }
}

// Pricing helpers
function formatPriceVal(price: number, currency: string): string {
  if (currency === 'cny') return `¥${price.toFixed(2)}`
  if (currency === 'usd') return `$${price.toFixed(2)}`
  if (currency === 'eur') return `€${price.toFixed(2)}`
  return `${price.toFixed(2)}`
}

function isCheapest(entry: any, type: 'new' | 'renew' | 'transfer'): boolean {
  if (!pricingData.value) return false
  const field = type === 'new' ? 'cheapestNew' : type === 'renew' ? 'cheapestRenew' : 'cheapestTransfer'
  const cheapest = pricingData.value[field]
  return cheapest?.registrar === entry.registrar
}

function applyPrice(entry: any) {
  if (entry.renewPrice !== null) form.renewal_price = entry.renewPrice
  if (entry.newPrice !== null) form.purchase_price = entry.newPrice
  form.currency = entry.currency === 'cny' ? 'CNY' : entry.currency === 'usd' ? 'USD' : entry.currency.toUpperCase()
  toast.success(t('pricing.applied', { name: entry.registrarName }))
}

// Pre-fill from query params (for "一键导入" from WHOIS page)
function prefillFromQuery() {
  const q = route.query
  if (q.domain) form.domain_name = String(q.domain)
  if (q.registrar) form.registrar = String(q.registrar)
  if (q.registration_date) form.registration_date = String(q.registration_date)
  if (q.expiry_date) form.expiry_date = String(q.expiry_date)
  if (q.dns_servers) form.dns_servers = String(q.dns_servers)
}

onMounted(() => {
  fetchTags()
  prefillFromQuery()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button
        class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        @click="router.back()"
      >
        <Icon name="heroicons:arrow-left" class="w-5 h-5" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('domains.addDomain') }}</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ t('domains.addNew') }}</p>
      </div>
    </div>

    <form @submit.prevent="submit(false)" class="space-y-6">
      <!-- 基础信息 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.form.basicInfo') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('domains.domainName') }} <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.domain_name"
                type="text"
                placeholder="example.com"
                class="flex-1 px-3 py-2 text-sm border rounded-lg input-focus"
                :class="errors.domain_name ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-300'"
              />
              <button
                type="button"
                :disabled="!form.domain_name.trim() || autoDetecting"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg transition-colors whitespace-nowrap"
                :class="autoDetecting
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  : form.domain_name.trim()
                    ? 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-400 bg-gray-50 cursor-not-allowed'"
                @click="autoDetect"
              >
                <div v-if="autoDetecting" class="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                <Icon v-else name="material-symbols:auto-fix-high" class="h-4 w-4" />
                {{ t('domains.form.autoDetect') }}
              </button>
            </div>
            <div class="flex items-center justify-between mt-1">
              <div class="flex items-center gap-2">
                <p v-if="errors.domain_name" class="text-xs text-red-500">{{ errors.domain_name }}</p>
                <span
                  v-if="autoDetectSource"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="autoDetectSource === 'RDAP' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'"
                >
                  via {{ autoDetectSource }}
                </span>
              </div>
              <p v-if="extractedTld" class="text-xs text-gray-400 ml-auto">TLD: {{ extractedTld }}</p>
            </div>
          </div>
          <!-- Appraisal inline -->
          <Transition name="slide-down">
            <div v-if="appraisalData" class="sm:col-span-2 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Icon name="material-symbols:diamond" class="w-5 h-5 text-purple-500" />
                  <div>
                    <span class="text-sm font-semibold text-purple-700">{{ t('appraisal.title') }}</span>
                    <span class="ml-2 text-lg font-bold text-purple-800">${{ appraisalData.estimatedValue?.toLocaleString() }}</span>
                    <span class="ml-1 text-sm text-purple-500">≈ ¥{{ appraisalData.estimatedValueCNY?.toLocaleString() }}</span>
                  </div>
                </div>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-700': appraisalData.confidence === 'high',
                    'bg-yellow-100 text-yellow-700': appraisalData.confidence === 'medium',
                    'bg-gray-100 text-gray-600': appraisalData.confidence === 'low',
                  }"
                >
                  {{ t('appraisal.confidence') }}: {{ appraisalData.confidence === 'high' ? t('statistics.valuation.high') : appraisalData.confidence === 'medium' ? t('statistics.valuation.medium') : t('statistics.valuation.low') }}
                </span>
              </div>
              <div v-if="appraisalData.factors?.length" class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="f in appraisalData.factors"
                  :key="f"
                  class="text-xs bg-white/70 text-purple-600 rounded px-1.5 py-0.5 border border-purple-100"
                >{{ f }}</span>
              </div>
            </div>
          </Transition>

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

      <!-- 时间信息 -->
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

      <!-- 费用信息 -->
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

      <!-- 续费价格参考 (nazhumi.com) -->
      <Transition name="slide-down">
        <div v-if="pricingData && pricingData.prices?.length" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {{ t('pricing.title') }}
              <span class="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                .{{ pricingData.tld }}
              </span>
            </h2>
            <a
              href="https://www.nazhumi.com/"
              target="_blank"
              class="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              {{ t('pricing.dataSource') }}
              <Icon name="material-symbols:open-in-new" class="w-3 h-3" />
            </a>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="py-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase">{{ t('pricing.registrarName') }}</th>
                  <th class="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase">{{ t('pricing.newPrice') }}</th>
                  <th class="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase">{{ t('pricing.renewPrice') }}</th>
                  <th class="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase">{{ t('pricing.transferPrice') }}</th>
                  <th class="py-2 pl-4 text-right text-xs font-medium text-gray-500 uppercase">{{ t('pricing.currency') }}</th>
                  <th class="py-2 pl-4 text-center text-xs font-medium text-gray-500 uppercase">{{ t('common.operations') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr
                  v-for="p in pricingData.prices"
                  :key="p.registrar"
                  class="hover:bg-gray-50/50 transition-colors"
                >
                  <td class="py-2.5 pr-4">
                    <a
                      v-if="p.registrarWeb"
                      :href="p.registrarWeb"
                      target="_blank"
                      class="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {{ p.registrarName }}
                    </a>
                    <span v-else class="font-medium text-gray-900">{{ p.registrarName }}</span>
                    <span v-if="p.hasPromoNew || p.hasPromoRenew" class="ml-1 text-xs text-orange-500">{{ t('pricing.promo') }}</span>
                  </td>
                  <td class="py-2.5 px-4 text-right tabular-nums" :class="isCheapest(p, 'new') ? 'text-green-600 font-semibold' : 'text-gray-700'">
                    {{ p.newPrice !== null ? formatPriceVal(p.newPrice, p.currency) : '-' }}
                  </td>
                  <td class="py-2.5 px-4 text-right tabular-nums" :class="isCheapest(p, 'renew') ? 'text-green-600 font-semibold' : 'text-gray-700'">
                    {{ p.renewPrice !== null ? formatPriceVal(p.renewPrice, p.currency) : '-' }}
                  </td>
                  <td class="py-2.5 px-4 text-right tabular-nums" :class="isCheapest(p, 'transfer') ? 'text-green-600 font-semibold' : 'text-gray-700'">
                    {{ p.transferPrice !== null ? formatPriceVal(p.transferPrice, p.currency) : '-' }}
                  </td>
                  <td class="py-2.5 pl-4 text-right text-xs text-gray-500">{{ p.currencyName }}</td>
                  <td class="py-2.5 pl-4 text-center">
                    <button
                      type="button"
                      class="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                      :title="t('pricing.use')"
                      @click="applyPrice(p)"
                    >
                      {{ t('pricing.use') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Transition>

      <!-- 扩展信息 -->
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
                v-for="t in tags"
                :key="t.id"
                type="button"
                class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                :class="form.tag_ids.includes(t.id)
                  ? 'border-transparent text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                :style="form.tag_ids.includes(t.id) ? { backgroundColor: t.color } : {}"
                @click="toggleTag(t.id)"
              >
                {{ t.name }}
              </button>
              <span v-if="tags.length === 0" class="text-sm text-gray-400">{{ t('domains.form.noTags') }}</span>
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
          @click="router.push('/domains')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="submit(true)"
        >
          {{ t('domains.form.saveAndContinue') }}
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
          <span v-else>{{ t('common.save') }}</span>
        </button>
      </div>
    </form>
  </div>
</template>
