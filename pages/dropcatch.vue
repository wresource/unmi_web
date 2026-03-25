<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()
const appStore = useAppStore()
appStore.setPageTitle(t('dropcatch.title'))

// State
const activeTab = ref<'droplist' | 'auction' | 'watchlist'>('droplist')
const loading = ref(false)
const showFilters = ref(true)

// Filters
const search = ref('')
const selectedTld = ref('')
const lengthFilter = ref<number | undefined>(undefined)
const maxPrice = ref<number | undefined>(undefined)
const statusFilter = ref('')
const dropWithinFilter = ref(10) // default: within 10 days
const sortBy = ref('drop_date')
const sortOrder = ref('ASC')
const page = ref(1)
const pageSize = ref(20)

// Data
const domains = ref<any[]>([])
const total = ref(0)
const availableTlds = ref<string[]>([])
const stats = ref<any>(null)
const watchlist = ref<any[]>([])
const watchlistDomainNames = ref<Set<string>>(new Set())
const lastRefresh = ref<string | null>(null)

// Watchlist dialog
const showWatchlistDialog = ref(false)
const watchlistDomainInput = ref('')
const watchlistNoteInput = ref('')

// Fetch stats
async function fetchStats() {
  try {
    stats.value = await $fetch('/api/dropcatch/stats')
  } catch {}
}

// Fetch domains
async function fetchDomains() {
  loading.value = true
  try {
    const query: any = {
      search: search.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      page: page.value,
      pageSize: pageSize.value,
    }
    if (selectedTld.value) query.tld = selectedTld.value
    if (lengthFilter.value) {
      query.minLength = lengthFilter.value
      query.maxLength = lengthFilter.value
    }
    if (maxPrice.value) query.maxPrice = maxPrice.value
    if (statusFilter.value) query.status = statusFilter.value

    // Source filter based on tab
    if (activeTab.value === 'auction') {
      query.source = 'auction'
    } else if (activeTab.value === 'droplist') {
      query.source = 'rdap'
    }

    // Drop within filter (only for droplist tab)
    if (activeTab.value === 'droplist' && dropWithinFilter.value >= 0) {
      query.dropWithin = dropWithinFilter.value
    }

    const res = await $fetch<any>('/api/dropcatch/domains', { query })
    domains.value = res.data
    total.value = res.total
    availableTlds.value = res.tlds
    if (res.lastRefresh) lastRefresh.value = res.lastRefresh
  } catch {
    toast.error('Failed to fetch domains')
  } finally {
    loading.value = false
  }
}

// Fetch watchlist
async function fetchWatchlist() {
  try {
    const res = await $fetch<any>('/api/dropcatch/watchlist')
    watchlist.value = res.data
    watchlistDomainNames.value = new Set(res.data.map((w: any) => w.domain_name))
  } catch {}
}

// Add to watchlist
async function addToWatchlist(domainName: string) {
  try {
    await $fetch('/api/dropcatch/watchlist', {
      method: 'POST',
      body: { domain_name: domainName, note: '' },
    })
    toast.success(t('dropcatch.addedToWatchlist'))
    watchlistDomainNames.value.add(domainName)
    await fetchWatchlist()
  } catch {
    toast.error('Failed to add to watchlist')
  }
}

// Add to watchlist via dialog
async function addWatchlistFromDialog() {
  if (!watchlistDomainInput.value.trim()) return
  try {
    await $fetch('/api/dropcatch/watchlist', {
      method: 'POST',
      body: { domain_name: watchlistDomainInput.value.trim(), note: watchlistNoteInput.value },
    })
    toast.success(t('dropcatch.addedToWatchlist'))
    showWatchlistDialog.value = false
    watchlistDomainInput.value = ''
    watchlistNoteInput.value = ''
    await fetchWatchlist()
  } catch {
    toast.error('Failed to add to watchlist')
  }
}

// Remove from watchlist
async function removeFromWatchlist(id: number, domainName: string) {
  try {
    await $fetch(`/api/dropcatch/watchlist/${id}`, { method: 'DELETE' })
    toast.success(t('dropcatch.removedFromWatchlist'))
    watchlistDomainNames.value.delete(domainName)
    await fetchWatchlist()
  } catch {
    toast.error('Failed to remove from watchlist')
  }
}

// Copy domain
function copyDomain(name: string) {
  navigator.clipboard.writeText(name)
  toast.success(t('dropcatch.copied'))
}

// Sort
function setSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC'
  } else {
    sortBy.value = field
    sortOrder.value = 'ASC'
  }
  page.value = 1
  fetchDomains()
}

// Pagination
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

function goPage(p: number) {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p
    fetchDomains()
  }
}

// Set length quick filter
function setLengthFilter(len: number | undefined) {
  lengthFilter.value = lengthFilter.value === len ? undefined : len
  page.value = 1
  fetchDomains()
}

// Set drop-within filter
function setDropWithin(days: number) {
  dropWithinFilter.value = days
  page.value = 1
  fetchDomains()
}

// Filters watch
watch([search, selectedTld, statusFilter], () => {
  page.value = 1
  fetchDomains()
})

// Tab change
watch(activeTab, () => {
  page.value = 1
  fetchDomains()
})

function applyRangeFilters() {
  page.value = 1
  fetchDomains()
}

// Status badge class
function statusClass(status: string) {
  if (status === 'pending_delete') return 'bg-red-100 text-red-700'
  if (status === 'registered') return 'bg-purple-100 text-purple-700'
  return 'bg-yellow-100 text-yellow-700'
}

// Status label
function statusLabel(status: string) {
  if (status === 'pending_delete') return t('dropcatch.pendingDelete')
  if (status === 'registered') return t('dropcatch.monitoring')
  if (status === 'expired') return t('domains.status.expired')
  if (status === 'available') return t('whois.notRegistered')
  return t('dropcatch.expiring')
}

// Format value
function formatValue(val: number) {
  return val >= 1000 ? `$${(val / 1000).toFixed(1)}K` : `$${val}`
}

// Days badge color
function daysBadgeClass(days: number | null) {
  if (days === null) return 'text-gray-400'
  if (days <= 0) return 'text-red-600 font-bold'
  if (days <= 3) return 'text-red-600 font-bold'
  if (days <= 7) return 'text-orange-500 font-semibold'
  if (days <= 10) return 'text-yellow-600'
  return 'text-gray-600'
}

// Format last refresh time
function formatLastRefresh(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

// Init
onMounted(async () => {
  await Promise.all([fetchDomains(), fetchStats(), fetchWatchlist()])
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('dropcatch.title') }}</h1>
        <p class="text-sm text-gray-500 mt-1">{{ t('dropcatch.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400">
          {{ t('dropcatch.autoUpdate') }}
          <template v-if="lastRefresh">
            &middot; {{ t('dropcatch.lastUpdate') }}: {{ formatLastRefresh(lastRefresh) }}
          </template>
        </span>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="stats" class="flex flex-wrap gap-4">
      <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <Icon name="material-symbols:delete-outline" class="h-5 w-5 text-red-500" />
        <span class="text-sm font-medium text-gray-700">{{ t('dropcatch.droppingCount', { n: stats.pendingDelete }) }}</span>
      </div>
      <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <Icon name="material-symbols:schedule" class="h-5 w-5 text-yellow-500" />
        <span class="text-sm font-medium text-gray-700">{{ t('dropcatch.pendingCount', { n: stats.expiring }) }}</span>
      </div>
      <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <Icon name="material-symbols:language" class="h-5 w-5 text-blue-500" />
        <span class="text-sm font-medium text-gray-700">{{ t('dropcatch.tldCount', { n: stats.distinctTlds }) }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      <button
        :class="['px-4 py-2 text-sm font-medium rounded-md transition-colors', activeTab === 'droplist' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        @click="activeTab = 'droplist'"
      >
        {{ t('dropcatch.dropList') }}
      </button>
      <button
        :class="['px-4 py-2 text-sm font-medium rounded-md transition-colors', activeTab === 'auction' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        @click="activeTab = 'auction'"
      >
        {{ t('dropcatch.auctionTab') }}
      </button>
      <button
        :class="['px-4 py-2 text-sm font-medium rounded-md transition-colors', activeTab === 'watchlist' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']"
        @click="activeTab = 'watchlist'"
      >
        {{ t('dropcatch.myWatchlist') }}
        <span v-if="watchlist.length" class="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{{ watchlist.length }}</span>
      </button>
    </div>

    <!-- Drop List / Auction Tab -->
    <div v-if="activeTab === 'droplist' || activeTab === 'auction'" class="flex gap-6">
      <!-- Filter sidebar -->
      <div
        :class="['shrink-0 transition-all duration-200', showFilters ? 'w-64' : 'w-0 overflow-hidden']"
      >
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900">{{ t('dropcatch.filters') }}</h3>
            <button class="text-gray-400 hover:text-gray-600" @click="showFilters = false">
              <Icon name="material-symbols:close" class="h-4 w-4" />
            </button>
          </div>

          <!-- Search -->
          <div>
            <input
              v-model="search"
              type="text"
              :placeholder="t('dropcatch.searchPlaceholder')"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 input-focus"
            />
          </div>

          <!-- TLD -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">{{ t('dropcatch.tldFilter') }}</label>
            <select
              v-model="selectedTld"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 input-focus"
            >
              <option value="">{{ t('dropcatch.allTypes') }}</option>
              <option v-for="tldOpt in availableTlds" :key="tldOpt" :value="tldOpt">{{ tldOpt }}</option>
            </select>
          </div>

          <!-- Length quick filters -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">{{ t('dropcatch.lengthRange') }}</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', !lengthFilter ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setLengthFilter(undefined)"
              >
                {{ t('dropcatch.allDomains') }}
              </button>
              <button
                v-for="len in [1, 2, 3, 4, 5]"
                :key="len"
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', lengthFilter === len ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setLengthFilter(len)"
              >
                {{ t(`dropcatch.chars${len}`) }}
              </button>
            </div>
          </div>

          <!-- Drop within filter (only for droplist) -->
          <div v-if="activeTab === 'droplist'">
            <label class="block text-xs font-medium text-gray-600 mb-2">{{ t('dropcatch.daysUntilDrop') }}</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', dropWithinFilter === -1 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setDropWithin(-1)"
              >
                {{ t('dropcatch.allDomains') }}
              </button>
              <button
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', dropWithinFilter === 0 ? 'bg-red-50 text-red-700 border-red-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setDropWithin(0)"
              >
                {{ t('dropcatch.today') }}
              </button>
              <button
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', dropWithinFilter === 10 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setDropWithin(10)"
              >
                {{ t('dropcatch.within10d') }}
              </button>
              <button
                :class="['px-2.5 py-1 text-xs rounded-md border transition-colors', dropWithinFilter === 30 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
                @click="setDropWithin(30)"
              >
                {{ t('dropcatch.within30d') }}
              </button>
            </div>
          </div>

          <!-- Value range -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">{{ t('dropcatch.priceRange') }}</label>
            <input
              v-model.number="maxPrice"
              type="number"
              min="0"
              placeholder="Max ($)"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 input-focus"
              @change="applyRangeFilters"
            />
          </div>

          <!-- Status -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">{{ t('dropcatch.statusFilter') }}</label>
            <select
              v-model="statusFilter"
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 input-focus"
            >
              <option value="">{{ t('dropcatch.allTypes') }}</option>
              <option value="pending_delete">{{ t('dropcatch.pendingDelete') }}</option>
              <option value="expiring">{{ t('dropcatch.expiring') }}</option>
              <option value="expired">{{ t('domains.status.expired') }}</option>
              <option value="available">{{ t('whois.notRegistered') }}</option>
            </select>
          </div>

          <!-- Info -->
          <div class="text-xs text-gray-400 pt-2 border-t border-gray-100">
            {{ t('dropcatch.letterOnly') }} &middot; 1-5
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <!-- Toolbar -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <button
              v-if="!showFilters"
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              @click="showFilters = true"
            >
              <Icon name="material-symbols:filter-list" class="h-4 w-4" />
              {{ t('dropcatch.filters') }}
            </button>
            <span class="text-sm text-gray-500">{{ t('common.total', { n: total }) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-for="s in [
                { key: 'drop_date', label: t('dropcatch.sortByDate') },
                { key: 'estimated_value', label: t('dropcatch.sortByValue') },
                { key: 'domain_length', label: t('dropcatch.sortByLength') },
                { key: 'domain_name', label: t('dropcatch.sortByName') },
              ]"
              :key="s.key"
              :class="['px-3 py-1.5 text-xs font-medium rounded-md transition-colors', sortBy === s.key ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50']"
              @click="setSort(s.key)"
            >
              {{ s.label }}
              <Icon
                v-if="sortBy === s.key"
                :name="sortOrder === 'ASC' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
                class="h-3 w-3 inline ml-0.5"
              />
            </button>
          </div>
        </div>

        <!-- Domain table -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div v-if="loading" class="flex items-center justify-center py-20">
            <Icon name="material-symbols:progress-activity" class="h-8 w-8 text-blue-500 animate-spin" />
          </div>
          <div v-else-if="domains.length === 0" class="text-center py-20 text-gray-400">
            <Icon name="material-symbols:search-off" class="h-12 w-12 mx-auto mb-3" />
            <p>{{ t('dropcatch.noResults') }}</p>
          </div>
          <table v-else class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="text-left px-4 py-3 font-medium text-gray-600">{{ t('dropcatch.domainName') }}</th>
                <th class="text-center px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">{{ t('dropcatch.length') }}</th>
                <th class="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell">{{ t('dropcatch.dropDate') }}</th>
                <th class="text-center px-3 py-3 font-medium text-gray-600">{{ t('dropcatch.daysUntilDrop') }}</th>
                <th class="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">{{ t('dropcatch.estimatedValue') }}</th>
                <th class="text-center px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">{{ t('dropcatch.status') }}</th>
                <th class="text-right px-4 py-3 font-medium text-gray-600">{{ t('common.operations') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="d in domains" :key="d.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-medium text-gray-900">{{ d.domain_name.split('.')[0] }}</span>
                    <span class="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-600">{{ d.tld }}</span>
                  </div>
                </td>
                <td class="text-center px-3 py-3 text-gray-600 hidden sm:table-cell">{{ d.domain_length }}</td>
                <td class="text-center px-3 py-3 text-gray-500 hidden md:table-cell">{{ d.drop_date ? d.drop_date.split('T')[0] : '-' }}</td>
                <td class="text-center px-3 py-3">
                  <span :class="daysBadgeClass(d.days_until_drop)">
                    {{ d.days_until_drop !== null ? d.days_until_drop + 'd' : '-' }}
                  </span>
                </td>
                <td class="text-right px-3 py-3 hidden sm:table-cell">
                  <span class="font-medium text-green-600">{{ formatValue(d.estimated_value) }}</span>
                </td>
                <td class="text-center px-3 py-3 hidden lg:table-cell">
                  <span :class="['inline-flex px-2 py-0.5 text-xs font-medium rounded-full', statusClass(d.status)]">
                    {{ statusLabel(d.status) }}
                  </span>
                </td>
                <td class="text-right px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      v-if="!watchlistDomainNames.has(d.domain_name)"
                      class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      :title="t('dropcatch.addToWatchlist')"
                      @click="addToWatchlist(d.domain_name)"
                    >
                      <Icon name="material-symbols:bookmark-add-outline" class="h-4 w-4" />
                    </button>
                    <span v-else class="p-1.5 text-blue-500" :title="t('dropcatch.addedToWatchlist')">
                      <Icon name="material-symbols:bookmark" class="h-4 w-4" />
                    </span>
                    <NuxtLink
                      :to="`/whois?domain=${d.domain_name}`"
                      class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                      :title="t('dropcatch.queryWhois')"
                    >
                      <Icon name="material-symbols:search" class="h-4 w-4" />
                    </NuxtLink>
                    <button
                      class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      :title="t('dropcatch.copyDomain')"
                      @click="copyDomain(d.domain_name)"
                    >
                      <Icon name="material-symbols:content-copy-outline" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
          <span class="text-sm text-gray-500">
            {{ t('common.pageInfo', { total, page, totalPages }) }}
          </span>
          <div class="flex items-center gap-1">
            <button
              :disabled="page <= 1"
              class="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              @click="goPage(page - 1)"
            >
              {{ t('common.prev') }}
            </button>
            <template v-for="p in totalPages" :key="p">
              <button
                v-if="p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)"
                :class="['px-3 py-1.5 text-sm rounded-md', p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50']"
                @click="goPage(p)"
              >
                {{ p }}
              </button>
              <span v-else-if="p === page - 3 || p === page + 3" class="px-1 text-gray-400">...</span>
            </template>
            <button
              :disabled="page >= totalPages"
              class="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              @click="goPage(page + 1)"
            >
              {{ t('common.next') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right sidebar - stats -->
      <div class="hidden xl:block w-64 shrink-0 space-y-4">
        <!-- TLD distribution -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('dropcatch.tldDistribution') }}</h3>
          <div v-if="stats?.byTld?.length" class="space-y-2">
            <div v-for="item in stats.byTld.slice(0, 8)" :key="item.tld" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ item.tld }}</span>
              <div class="flex items-center gap-2">
                <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 rounded-full"
                    :style="{ width: `${(item.cnt / stats.total * 100)}%` }"
                  />
                </div>
                <span class="text-xs text-gray-400 w-8 text-right">{{ item.cnt }}</span>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">{{ t('common.noData') }}</p>
        </div>

        <!-- Length distribution -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('dropcatch.lengthDistribution') }}</h3>
          <div v-if="stats?.byLength?.length" class="space-y-2">
            <div v-for="item in stats.byLength" :key="item.range" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ item.range }}</span>
              <div class="flex items-center gap-2">
                <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-green-500 rounded-full"
                    :style="{ width: `${(item.cnt / stats.total * 100)}%` }"
                  />
                </div>
                <span class="text-xs text-gray-400 w-8 text-right">{{ item.cnt }}</span>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">{{ t('common.noData') }}</p>
        </div>

        <!-- Data source note -->
        <div class="bg-blue-50 rounded-lg border border-blue-100 p-4">
          <h3 class="text-sm font-semibold text-blue-900 mb-1">{{ t('dropcatch.dataSource') }}</h3>
          <p class="text-xs text-blue-700">{{ t('dropcatch.dataSourceDesc') }}</p>
        </div>
      </div>
    </div>

    <!-- Watchlist Tab -->
    <div v-if="activeTab === 'watchlist'" class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">{{ t('common.total', { n: watchlist.length }) }}</span>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          @click="showWatchlistDialog = true"
        >
          <Icon name="material-symbols:add" class="h-4 w-4" />
          {{ t('dropcatch.addToWatchlist') }}
        </button>
      </div>

      <div v-if="watchlist.length === 0" class="bg-white rounded-lg border border-gray-200 shadow-sm p-16 text-center text-gray-400">
        <Icon name="material-symbols:bookmark-outline" class="h-12 w-12 mx-auto mb-3" />
        <p>{{ t('dropcatch.watchlistEmpty') }}</p>
      </div>

      <div v-else class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-600">{{ t('dropcatch.domainName') }}</th>
              <th class="text-left px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">{{ t('dropcatch.watchlistNote') }}</th>
              <th class="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell">{{ t('dropcatch.status') }}</th>
              <th class="text-right px-4 py-3 font-medium text-gray-600">{{ t('common.operations') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="w in watchlist" :key="w.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-medium text-gray-900">{{ w.domain_name.split('.')[0] }}</span>
                  <span class="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-600">{{ w.tld }}</span>
                </div>
              </td>
              <td class="px-3 py-3 text-gray-500 hidden sm:table-cell">{{ w.note || '-' }}</td>
              <td class="text-center px-3 py-3 hidden md:table-cell">
                <span class="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">{{ w.status }}</span>
              </td>
              <td class="text-right px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/whois?domain=${w.domain_name}`"
                    class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                    :title="t('dropcatch.queryWhois')"
                  >
                    <Icon name="material-symbols:search" class="h-4 w-4" />
                  </NuxtLink>
                  <button
                    class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    :title="t('dropcatch.copyDomain')"
                    @click="copyDomain(w.domain_name)"
                  >
                    <Icon name="material-symbols:content-copy-outline" class="h-4 w-4" />
                  </button>
                  <button
                    class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    :title="t('dropcatch.removeFromWatchlist')"
                    @click="removeFromWatchlist(w.id, w.domain_name)"
                  >
                    <Icon name="material-symbols:delete-outline" class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add to watchlist dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showWatchlistDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showWatchlistDialog = false">
          <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('dropcatch.addToWatchlist') }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('dropcatch.domainName') }}</label>
                <input
                  v-model="watchlistDomainInput"
                  type="text"
                  placeholder="example.com"
                  class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg input-focus"
                  @keyup.enter="addWatchlistFromDialog"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('dropcatch.watchlistNote') }}</label>
                <input
                  v-model="watchlistNoteInput"
                  type="text"
                  :placeholder="t('dropcatch.watchlistNotePlaceholder')"
                  class="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg input-focus"
                />
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button
                class="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                @click="showWatchlistDialog = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                @click="addWatchlistFromDialog"
              >
                {{ t('common.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
