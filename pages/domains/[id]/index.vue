<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const domainId = computed(() => Number(route.params.id))

const loading = ref(true)
const domain = ref<any>(null)
const showDeleteDialog = ref(false)
const deleteLoading = ref(false)
const showRenewalModal = ref(false)
const renewalLoading = ref(false)
const whoisLoading = ref(false)
const whoisData = ref<any>(null)
const showDeleteRenewalDialog = ref(false)
const deletingRenewalId = ref<number | null>(null)

// Renewal form
const renewalForm = reactive({
  renewal_date: '',
  renewal_years: 1,
  renewal_price: 0,
  registrar: '',
  memo: '',
})

// Fetch domain
async function fetchDomain() {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/domains/${domainId.value}`)
    domain.value = res.data
  } catch (err: any) {
    toast.error(t('domains.detail.fetchFailed') + ': ' + (err.data?.statusMessage || err.message))
    router.push('/domains')
  } finally {
    loading.value = false
  }
}

// Delete domain
async function handleDelete() {
  deleteLoading.value = true
  try {
    await $fetch(`/api/domains/${domainId.value}`, { method: 'DELETE' })
    toast.success(t('domains.detail.domainDeleted'))
    showDeleteDialog.value = false
    router.push('/domains')
  } catch (err: any) {
    toast.error(t('domains.detail.deleteFailed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    deleteLoading.value = false
  }
}

// Whois query
async function queryWhois() {
  if (!domain.value) return
  whoisLoading.value = true
  try {
    const res = await $fetch<any>('/api/whois/query', {
      method: 'POST',
      body: { domain: domain.value.domain_name },
    })
    whoisData.value = res.data
    toast.success(t('domains.detail.whoisComplete'))
  } catch (err: any) {
    toast.error(t('domains.detail.whoisFailed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    whoisLoading.value = false
  }
}

// Add renewal record
async function addRenewalRecord() {
  if (!renewalForm.renewal_date) {
    toast.warning(t('domains.detail.selectRenewalDate'))
    return
  }
  renewalLoading.value = true
  try {
    await $fetch('/api/renewal-records', {
      method: 'POST',
      body: {
        domain_id: domainId.value,
        ...renewalForm,
      },
    })
    toast.success(t('domains.detail.renewalAdded'))
    showRenewalModal.value = false
    // Reset form
    renewalForm.renewal_date = ''
    renewalForm.renewal_years = 1
    renewalForm.renewal_price = 0
    renewalForm.registrar = ''
    renewalForm.memo = ''
    await fetchDomain()
  } catch (err: any) {
    toast.error(t('domains.detail.renewalAddFailed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    renewalLoading.value = false
  }
}

// Delete renewal record
function confirmDeleteRenewal(id: number) {
  deletingRenewalId.value = id
  showDeleteRenewalDialog.value = true
}

async function handleDeleteRenewal() {
  if (!deletingRenewalId.value) return
  try {
    await $fetch(`/api/renewal-records/${deletingRenewalId.value}`, { method: 'DELETE' })
    toast.success(t('domains.detail.renewalDeleted'))
    showDeleteRenewalDialog.value = false
    await fetchDomain()
  } catch (err: any) {
    toast.error(t('domains.detail.renewalDeleteFailed') + ': ' + (err.data?.statusMessage || err.message))
  }
  deletingRenewalId.value = null
}

// Formatters
function formatDate(date: string | null) {
  if (!date) return '--'
  return new Date(date).toLocaleDateString('zh-CN')
}

function formatPrice(price: number | null | undefined) {
  if (price === null || price === undefined || price === 0) return '--'
  return `\u00A5${price.toFixed(2)}`
}

onMounted(() => {
  fetchDomain()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-500">{{ t('common.loading') }}</span>
      </div>
    </div>

    <template v-else-if="domain">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <button
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            @click="router.push('/domains')"
          >
            <Icon name="heroicons:arrow-left" class="w-5 h-5" />
          </button>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900">{{ domain.domain_name }}</h1>
              <CommonStatusBadge :status="domain.status" />
            </div>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ t('domains.detail.addedAt', { date: formatDate(domain.created_at) }) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-14 sm:ml-0">
          <NuxtLink
            :to="`/domains/${domain.id}/edit`"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span class="flex items-center gap-1.5">
              <Icon name="heroicons:pencil-square" class="w-4 h-4" />
              {{ t('common.edit') }}
            </span>
          </NuxtLink>
          <button
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            :disabled="whoisLoading"
            @click="queryWhois"
          >
            <span class="flex items-center gap-1.5">
              <Icon v-if="whoisLoading" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
              <Icon v-else name="heroicons:magnifying-glass-circle" class="w-4 h-4" />
              {{ t('domains.detail.queryWhois') }}
            </span>
          </button>
          <button
            class="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            @click="showRenewalModal = true"
          >
            <span class="flex items-center gap-1.5">
              <Icon name="heroicons:plus" class="w-4 h-4" />
              {{ t('domains.detail.addRenewal') }}
            </span>
          </button>
          <button
            class="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            @click="showDeleteDialog = true"
          >
            <Icon name="heroicons:trash" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Basic info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="heroicons:information-circle" class="w-5 h-5 text-gray-400" />
            {{ t('domains.detail.basicInfo') }}
          </h2>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.registrar') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ domain.registrar || '--' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.registrationDate') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatDate(domain.registration_date) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.expiryDate') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatDate(domain.expiry_date) }}</dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-gray-500">{{ t('domains.remainingDays') }}</dt>
              <dd>
                <CommonDaysRemaining v-if="domain.expiry_date" :expire-date="domain.expiry_date" />
                <span v-else class="text-sm text-gray-400">--</span>
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.autoRenew') }}</dt>
              <dd>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="domain.auto_renew ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                >
                  {{ domain.auto_renew ? t('common.enabled') : t('common.disabled') }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.dnsProvider') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ domain.dns_servers || '--' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.tld') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ domain.tld || '--' }}</dd>
            </div>
          </dl>
        </div>

        <!-- Cost info -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="heroicons:currency-yen" class="w-5 h-5 text-gray-400" />
            {{ t('domains.detail.costInfo') }}
          </h2>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.purchasePrice') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatPrice(domain.purchase_price) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.renewalPrice') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatPrice(domain.renewal_price) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">{{ t('domains.detail.holdCost') }}</dt>
              <dd class="text-sm font-medium text-gray-900">{{ formatPrice(domain.hold_cost) }}</dd>
            </div>
          </dl>

          <!-- Total cost summary -->
          <div class="mt-6 pt-4 border-t border-gray-100">
            <div class="flex justify-between">
              <dt class="text-sm font-medium text-gray-700">{{ t('domains.detail.totalInvestment') }}</dt>
              <dd class="text-sm font-bold text-primary-600">
                {{ formatPrice((domain.purchase_price || 0) + (domain.hold_cost || 0)) }}
              </dd>
            </div>
          </div>
        </div>

        <!-- Tags & Notes -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="heroicons:tag" class="w-5 h-5 text-gray-400" />
            {{ t('domains.detail.tagsNotes') }}
          </h2>
          <div class="space-y-4">
            <div>
              <dt class="text-sm text-gray-500 mb-2">{{ t('domains.tags') }}</dt>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tg in domain.tags"
                  :key="tg.id"
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  :style="{ backgroundColor: tg.color + '20', color: tg.color }"
                >
                  {{ tg.name }}
                </span>
                <span v-if="!domain.tags?.length" class="text-sm text-gray-400">{{ t('domains.detail.noTags') }}</span>
              </div>
            </div>
            <div>
              <dt class="text-sm text-gray-500 mb-2">{{ t('domains.notes') }}</dt>
              <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ domain.memo || t('domains.detail.noNotes') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Registrant Info -->
      <div
        v-if="domain.registrant_name || domain.registrant_org || domain.registrant_email || domain.registrant_phone || domain.registrant_country || domain.registrant_province || domain.registrant_city || domain.registrant_address || domain.admin_name || domain.admin_email || domain.tech_name || domain.tech_email"
        class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="heroicons:user-circle" class="w-5 h-5 text-gray-400" />
          {{ t('domains.form.registrantInfo') }}
        </h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          <div v-if="domain.registrant_name" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantName') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_name }}</dd>
          </div>
          <div v-if="domain.registrant_org" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantOrg') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_org }}</dd>
          </div>
          <div v-if="domain.registrant_email" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantEmail') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_email }}</dd>
          </div>
          <div v-if="domain.registrant_phone" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantPhone') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_phone }}</dd>
          </div>
          <div v-if="domain.registrant_country" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantCountry') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_country }}</dd>
          </div>
          <div v-if="domain.registrant_province" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantProvince') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_province }}</dd>
          </div>
          <div v-if="domain.registrant_city" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantCity') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_city }}</dd>
          </div>
          <div v-if="domain.registrant_address" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.registrantAddress') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.registrant_address }}</dd>
          </div>
          <div v-if="domain.admin_name" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.adminName') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.admin_name }}</dd>
          </div>
          <div v-if="domain.admin_email" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.adminEmail') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.admin_email }}</dd>
          </div>
          <div v-if="domain.tech_name" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.techName') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.tech_name }}</dd>
          </div>
          <div v-if="domain.tech_email" class="flex justify-between sm:flex-col">
            <dt class="text-sm text-gray-500">{{ t('domains.form.techEmail') }}</dt>
            <dd class="text-sm font-medium text-gray-900">{{ domain.tech_email }}</dd>
          </div>
        </dl>
      </div>

      <!-- Renewal Records -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="heroicons:clock" class="w-5 h-5 text-gray-400" />
            {{ t('domains.detail.renewalRecords') }}
          </h2>
          <button
            class="text-sm text-primary-600 hover:text-primary-700 font-medium"
            @click="showRenewalModal = true"
          >
            {{ t('domains.detail.addRecord') }}
          </button>
        </div>

        <div v-if="domain.renewalRecords?.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left font-medium text-gray-600">{{ t('domains.detail.renewalDate') }}</th>
                <th class="px-6 py-3 text-left font-medium text-gray-600">{{ t('domains.detail.renewalYears') }}</th>
                <th class="px-6 py-3 text-left font-medium text-gray-600">{{ t('domains.detail.renewalPriceLabel') }}</th>
                <th class="px-6 py-3 text-left font-medium text-gray-600">{{ t('domains.registrar') }}</th>
                <th class="px-6 py-3 text-left font-medium text-gray-600">{{ t('domains.notes') }}</th>
                <th class="px-6 py-3 text-right font-medium text-gray-600">{{ t('common.operations') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="record in domain.renewalRecords" :key="record.id" class="hover:bg-gray-50">
                <td class="px-6 py-3 text-gray-900">{{ formatDate(record.renewal_date) }}</td>
                <td class="px-6 py-3 text-gray-600">{{ t('domains.detail.yearsUnit', { n: record.renewal_years }) }}</td>
                <td class="px-6 py-3 text-gray-900">{{ formatPrice(record.renewal_price) }}</td>
                <td class="px-6 py-3 text-gray-600">{{ record.registrar || '--' }}</td>
                <td class="px-6 py-3 text-gray-500 max-w-[200px] truncate">{{ record.memo || '--' }}</td>
                <td class="px-6 py-3 text-right">
                  <button
                    class="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                    :title="t('common.delete')"
                    @click="confirmDeleteRenewal(record.id)"
                  >
                    <Icon name="heroicons:trash" class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-12 text-center">
          <Icon name="heroicons:clock" class="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p class="text-sm text-gray-500">{{ t('domains.detail.noRenewals') }}</p>
        </div>
      </div>

      <!-- Whois Result -->
      <div v-if="whoisData" class="bg-white rounded-xl shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="heroicons:magnifying-glass-circle" class="w-5 h-5 text-gray-400" />
            {{ t('domains.detail.whoisResult') }}
          </h2>
          <button
            class="text-sm text-gray-500 hover:text-gray-700"
            @click="whoisData = null"
          >
            {{ t('common.close') }}
          </button>
        </div>
        <div class="p-6">
          <!-- Parsed info -->
          <div v-if="typeof whoisData === 'object' && !Array.isArray(whoisData)" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-for="(value, key) in whoisData" :key="key" class="flex flex-col">
                <span class="text-xs font-medium text-gray-500 uppercase">{{ key }}</span>
                <span class="text-sm text-gray-900 mt-0.5 break-all">
                  {{ Array.isArray(value) ? value.join(', ') : value }}
                </span>
              </div>
            </div>
          </div>
          <!-- Raw text fallback -->
          <div v-else>
            <pre class="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(whoisData, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </template>

    <!-- Add Renewal Modal -->
    <CommonModal v-model="showRenewalModal" :title="t('domains.detail.addRenewal')" width="max-w-lg">
      <form @submit.prevent="addRenewalRecord" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t('domains.detail.renewalDate') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="renewalForm.renewal_date"
            type="date"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.detail.renewalYears') }}</label>
            <input
              v-model.number="renewalForm.renewal_years"
              type="number"
              min="1"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.detail.renewalPriceLabel') }}</label>
            <input
              v-model.number="renewalForm.renewal_price"
              type="number"
              step="0.01"
              min="0"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.detail.registrarLabel') }}</label>
          <input
            v-model="renewalForm.registrar"
            type="text"
            :placeholder="t('domains.detail.optional')"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('domains.detail.memoLabel') }}</label>
          <textarea
            v-model="renewalForm.memo"
            rows="2"
            :placeholder="t('domains.detail.optional')"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg input-focus resize-none"
          />
        </div>
      </form>
      <template #footer>
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="showRenewalModal = false"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          :disabled="renewalLoading"
          @click="addRenewalRecord"
        >
          <span v-if="renewalLoading" class="flex items-center gap-2">
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ t('common.saving') }}
          </span>
          <span v-else>{{ t('common.save') }}</span>
        </button>
      </template>
    </CommonModal>

    <!-- Delete Domain Dialog -->
    <CommonConfirmDialog
      v-model="showDeleteDialog"
      :title="t('domains.detail.deleteDomain')"
      :message="t('domains.detail.deleteConfirmMsg')"
      :confirm-text="t('common.delete')"
      confirm-color="red"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Delete Renewal Dialog -->
    <CommonConfirmDialog
      v-model="showDeleteRenewalDialog"
      :title="t('domains.detail.deleteRenewal')"
      :message="t('domains.detail.deleteRenewalConfirm')"
      :confirm-text="t('common.delete')"
      confirm-color="red"
      @confirm="handleDeleteRenewal"
      @cancel="showDeleteRenewalDialog = false"
    />
  </div>
</template>
