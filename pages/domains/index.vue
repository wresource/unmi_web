<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

// Query params
const search = ref('')
const registrar = ref('')
const status = ref('')
const tld = ref('')
const tag = ref('')
const expireDays = ref<number | ''>('')
const autoRenew = ref('')
const sortBy = ref('expiry_date')
const sortOrder = ref<'ASC' | 'DESC'>('ASC')
const page = ref(1)
const pageSize = ref(20)

// UI state
const loading = ref(false)
const showFilters = ref(false)
const selectedIds = ref<number[]>([])
const showDeleteDialog = ref(false)
const showBatchDeleteDialog = ref(false)
const deletingId = ref<number | null>(null)
const deleteLoading = ref(false)

// Data
const domains = ref<any[]>([])
const total = ref(0)

// Filter options
const registrars = ref<string[]>([])
const tlds = ref<string[]>([])
const tags = ref<any[]>([])

const statusOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'active', label: t('domains.status.active') },
  { value: 'expired', label: t('domains.status.expired') },
  { value: 'transferring', label: t('domains.status.transferring') },
  { value: 'pending_delete', label: t('domains.status.pending_delete') },
  { value: 'redemption', label: t('domains.status.redemption') },
  { value: 'reserved', label: t('domains.status.reserved') },
])

// Fetch domains
async function fetchDomains() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    }
    if (search.value) params.search = search.value
    if (registrar.value) params.registrar = registrar.value
    if (status.value) params.status = status.value
    if (tld.value) params.tld = tld.value
    if (tag.value) params.tag = tag.value
    if (expireDays.value) params.expireDays = expireDays.value

    const res = await $fetch<any>('/api/domains', { params })
    domains.value = res.data
    total.value = res.total
  } catch (err: any) {
    toast.error(t('domains.importFailed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    loading.value = false
  }
}

// Fetch filter options
async function fetchFilterOptions() {
  try {
    const [tagsRes, domainsRes] = await Promise.all([
      $fetch<any>('/api/tags'),
      $fetch<any>('/api/domains', { params: { pageSize: 1000 } }),
    ])
    tags.value = tagsRes.data || []

    const allDomains = domainsRes.data || []
    const regSet = new Set<string>()
    const tldSet = new Set<string>()
    for (const d of allDomains) {
      if (d.registrar) regSet.add(d.registrar)
      if (d.tld) tldSet.add(d.tld)
    }
    registrars.value = Array.from(regSet).sort()
    tlds.value = Array.from(tldSet).sort()
  } catch {
    // silently fail
  }
}

// Watchers
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchDomains()
  }, 300)
})

watch([registrar, status, tld, tag, expireDays, autoRenew, sortBy, sortOrder], () => {
  page.value = 1
  fetchDomains()
})

watch(page, () => {
  fetchDomains()
})

// Select all
const allSelected = computed({
  get: () => domains.value.length > 0 && selectedIds.value.length === domains.value.length,
  set: (val: boolean) => {
    selectedIds.value = val ? domains.value.map((d) => d.id) : []
  },
})

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

// Sort
function handleSort(column: string) {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC'
  } else {
    sortBy.value = column
    sortOrder.value = 'ASC'
  }
}

function sortIcon(column: string) {
  if (sortBy.value !== column) return ''
  return sortOrder.value === 'ASC' ? '\u2191' : '\u2193'
}

// Delete
function confirmDelete(id: number) {
  deletingId.value = id
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deletingId.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/domains/${deletingId.value}`, { method: 'DELETE' })
    toast.success(t('common.success'))
    showDeleteDialog.value = false
    selectedIds.value = selectedIds.value.filter((id) => id !== deletingId.value)
    await fetchDomains()
  } catch (err: any) {
    toast.error(t('common.failed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    deleteLoading.value = false
    deletingId.value = null
  }
}

// Batch delete
async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return
  deleteLoading.value = true
  try {
    await $fetch('/api/domains/batch-delete', {
      method: 'POST',
      body: { ids: selectedIds.value },
    })
    toast.success(t('common.success'))
    showBatchDeleteDialog.value = false
    selectedIds.value = []
    await fetchDomains()
  } catch (err: any) {
    toast.error(t('common.failed') + ': ' + (err.data?.statusMessage || err.message))
  } finally {
    deleteLoading.value = false
  }
}

// Export
async function handleExport() {
  try {
    const blob = await $fetch<Blob>('/api/domains/export', { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `domains-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('domains.exportSuccess'))
  } catch (err: any) {
    toast.error(t('domains.exportFailed') + ': ' + (err.data?.statusMessage || err.message))
  }
}

// Import
const importInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  importInput.value?.click()
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  try {
    await $fetch('/api/domains/import', { method: 'POST', body: formData })
    toast.success(t('domains.importSuccess'))
    await fetchDomains()
    await fetchFilterOptions()
  } catch (err: any) {
    toast.error(t('domains.importFailed') + ': ' + (err.data?.statusMessage || err.message))
  }

  if (importInput.value) importInput.value.value = ''
}

// Whois
async function queryWhois(domainName: string) {
  try {
    toast.info(t('whois.querying'))
    const res = await $fetch<any>('/api/whois/query', {
      method: 'POST',
      body: { domain: domainName },
    })
    toast.success(t('common.success'))
    // Navigate to detail page to see results
    const domain = domains.value.find((d) => d.domain_name === domainName)
    if (domain) {
      router.push(`/domains/${domain.id}`)
    }
  } catch (err: any) {
    toast.error(t('common.failed') + ': ' + (err.data?.statusMessage || err.message))
  }
}

// Reset filters
function resetFilters() {
  search.value = ''
  registrar.value = ''
  status.value = ''
  tld.value = ''
  tag.value = ''
  expireDays.value = ''
  autoRenew.value = ''
}

// Format
function formatDate(date: string | null) {
  if (!date) return '--'
  return new Date(date).toLocaleDateString('zh-CN')
}

function formatPrice(price: number | null) {
  if (price === null || price === undefined || price === 0) return '--'
  return `\u00A5${price.toFixed(2)}`
}

// Init
onMounted(() => {
  fetchDomains()
  fetchFilterOptions()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">{{ t('domains.title') }}</h1>
      <div class="flex items-center gap-2">
        <input
          ref="importInput"
          type="file"
          accept=".json,.csv,.xlsx"
          class="hidden"
          @change="handleImport"
        />
        <button
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          @click="triggerImport"
        >
          <span class="flex items-center gap-1.5">
            <Icon name="heroicons:arrow-up-tray" class="w-4 h-4" />
            {{ t('common.import') }}
          </span>
        </button>
        <button
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          @click="handleExport"
        >
          <span class="flex items-center gap-1.5">
            <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" />
            {{ t('common.export') }}
          </span>
        </button>
        <NuxtLink
          to="/domains/create"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <span class="flex items-center gap-1.5">
            <Icon name="heroicons:plus" class="w-4 h-4" />
            {{ t('domains.addDomain') }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <!-- Search and Filter Toggle -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200">
      <div class="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div class="relative flex-1">
          <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="search"
            type="text"
            :placeholder="t('domains.searchPlaceholder')"
            class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg input-focus"
          />
        </div>
        <button
          class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
          :class="showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'"
          @click="showFilters = !showFilters"
        >
          <span class="flex items-center gap-1.5">
            <Icon name="heroicons:funnel" class="w-4 h-4" />
            {{ t('common.filter') }}
          </span>
        </button>
        <button
          v-if="showFilters"
          class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          @click="resetFilters"
        >
          {{ t('common.reset') }}
        </button>
      </div>

      <!-- Collapsible Filters -->
      <Transition name="fade">
        <div v-if="showFilters" class="px-4 pb-4 border-t border-gray-100 pt-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('domains.registrar') }}</label>
              <select v-model="registrar" class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus">
                <option value="">{{ t('common.all') }}</option>
                <option v-for="r in registrars" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('domains.status') }}</label>
              <select v-model="status" class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus">
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">TLD</label>
              <select v-model="tld" class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus">
                <option value="">{{ t('common.all') }}</option>
                <option v-for="t in tlds" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('domains.tags') }}</label>
              <select v-model="tag" class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus">
                <option value="">{{ t('common.all') }}</option>
                <option v-for="t in tags" :key="t.id" :value="t.name">{{ t.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('domains.remainingDays') }}</label>
              <input
                v-model.number="expireDays"
                type="number"
                min="0"
                :placeholder="t('domains.form.expiryDaysPlaceholder')"
                class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('domains.form.autoRenew') }}</label>
              <select v-model="autoRenew" class="w-full text-sm border border-gray-300 rounded-lg py-2 px-3 input-focus">
                <option value="">{{ t('common.all') }}</option>
                <option value="1">{{ t('common.enabled') }}</option>
                <option value="0">{{ t('common.disabled') }}</option>
              </select>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Batch Actions Bar -->
    <Transition name="fade">
      <div
        v-if="selectedIds.length > 0"
        class="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 flex items-center justify-between"
      >
        <span class="text-sm text-primary-700">
          {{ t('common.selected', { n: selectedIds.length }) }}
        </span>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            @click="showBatchDeleteDialog = true"
          >
            {{ t('domains.batchDelete') }}
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            @click="handleExport"
          >
            {{ t('domains.batchExport') }}
          </button>
          <button
            class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            @click="selectedIds = []"
          >
            {{ t('domains.cancelSelection') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <!-- Loading overlay -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-3">
          <svg class="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-sm text-gray-500">{{ t('common.loading') }}</span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="domains.length === 0" class="flex flex-col items-center justify-center py-20 px-4">
        <Icon name="heroicons:globe-alt" class="w-16 h-16 text-gray-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-1">{{ t('domains.noDomains') }}</h3>
        <p class="text-sm text-gray-500 mb-6">{{ t('domains.noDomainsDesc') }}</p>
        <NuxtLink
          to="/domains/create"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {{ t('domains.addDomain') }}
        </NuxtLink>
      </div>

      <!-- Data table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  v-model="allSelected"
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th
                class="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                @click="handleSort('domain_name')"
              >
                {{ t('domains.domainName') }} {{ sortIcon('domain_name') }}
              </th>
              <th class="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{{ t('domains.registrar') }}</th>
              <th
                class="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                @click="handleSort('expiry_date')"
              >
                {{ t('domains.expiryDate') }} {{ sortIcon('expiry_date') }}
              </th>
              <th class="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{{ t('domains.remainingDays') }}</th>
              <th
                class="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                @click="handleSort('renewal_price')"
              >
                {{ t('domains.renewalPrice') }} {{ sortIcon('renewal_price') }}
              </th>
              <th class="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{{ t('domains.status') }}</th>
              <th class="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{{ t('domains.tags') }}</th>
              <th class="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{{ t('domains.notes') }}</th>
              <th
                class="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                @click="handleSort('updated_at')"
              >
                {{ t('domains.updateTime') }} {{ sortIcon('updated_at') }}
              </th>
              <th class="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">{{ t('common.operations') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="domain in domains"
              :key="domain.id"
              class="hover:bg-gray-50 transition-colors"
              :class="{ 'bg-primary-50/50': selectedIds.includes(domain.id) }"
            >
              <td class="px-4 py-3">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(domain.id)"
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  @change="toggleSelect(domain.id)"
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <NuxtLink
                    :to="`/domains/${domain.id}`"
                    class="text-primary-600 hover:text-primary-800 font-medium"
                  >
                    {{ domain.domain_name }}
                  </NuxtLink>
                  <Icon v-if="domain.is_verified" name="material-symbols:verified" class="w-4 h-4 text-blue-500 shrink-0" :title="t('domains.verification.verified')" />
                </div>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ domain.registrar || '--' }}</td>
              <td class="px-4 py-3 text-gray-600 whitespace-nowrap">{{ formatDate(domain.expiry_date) }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <CommonDaysRemaining v-if="domain.expiry_date" :expire-date="domain.expiry_date" />
                <span v-else class="text-gray-400">--</span>
              </td>
              <td class="px-4 py-3 text-gray-600 whitespace-nowrap">{{ formatPrice(domain.renewal_price) }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <CommonStatusBadge :status="domain.status" />
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="t in domain.tags"
                    :key="t.id"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :style="{ backgroundColor: t.color + '20', color: t.color }"
                  >
                    {{ t.name }}
                  </span>
                  <span v-if="!domain.tags?.length" class="text-gray-400">--</span>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-500 max-w-[150px] truncate">{{ domain.memo || '--' }}</td>
              <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{{ formatDate(domain.updated_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/domains/${domain.id}`"
                    class="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 transition-colors"
                    :title="t('common.viewDetail')"
                  >
                    <Icon name="heroicons:eye" class="w-4 h-4" />
                  </NuxtLink>
                  <NuxtLink
                    :to="`/domains/${domain.id}/edit`"
                    class="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 transition-colors"
                    :title="t('common.edit')"
                  >
                    <Icon name="heroicons:pencil-square" class="w-4 h-4" />
                  </NuxtLink>
                  <button
                    class="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100 transition-colors"
                    :title="t('nav.whoisQuery')"
                    @click="queryWhois(domain.domain_name)"
                  >
                    <Icon name="heroicons:magnifying-glass-circle" class="w-4 h-4" />
                  </button>
                  <button
                    class="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                    :title="t('common.delete')"
                    @click="confirmDelete(domain.id)"
                  >
                    <Icon name="heroicons:trash" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && domains.length > 0" class="border-t border-gray-200">
        <CommonPagination
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="page = $event"
        />
      </div>
    </div>

    <!-- Delete Confirm Dialog -->
    <CommonConfirmDialog
      v-model="showDeleteDialog"
      :title="t('common.delete')"
      :message="t('domains.deleteConfirm')"
      :confirm-text="t('common.delete')"
      confirm-color="red"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Batch Delete Confirm Dialog -->
    <CommonConfirmDialog
      v-model="showBatchDeleteDialog"
      :title="t('domains.batchDelete')"
      :message="t('domains.batchDeleteConfirm', { n: selectedIds.length })"
      :confirm-text="t('common.delete')"
      confirm-color="red"
      :loading="deleteLoading"
      @confirm="handleBatchDelete"
      @cancel="showBatchDeleteDialog = false"
    />
  </div>
</template>
