<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()
const appStore = useAppStore()
appStore.setPageTitle(t('dropcatch.title'))

// State
const loading = ref(false)
const apiConfigured = ref(true)

// Filters
const search = ref('')
const selectedTld = ref('')
const lengthFilter = ref<number | undefined>(undefined)
const statusFilter = ref('')
const dropWithinFilter = ref(-1) // default: all
const sortBy = ref('drop_date')
const sortOrder = ref('ASC')
const page = ref(1)
const pageSize = ref(50)

// Data
const domains = ref<any[]>([])
const total = ref(0)
const availableTlds = ref<string[]>([])
const lastRefresh = ref<string | null>(null)

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
    if (statusFilter.value) query.status = statusFilter.value

    // Drop within filter
    if (dropWithinFilter.value >= 0) {
      query.dropWithin = dropWithinFilter.value
    }

    const res = await $fetch<any>('/api/dropcatch/domains', { query })
    domains.value = res.data
    total.value = res.total
    availableTlds.value = res.tlds
    apiConfigured.value = res.configured !== false
    if (res.lastRefresh) lastRefresh.value = res.lastRefresh
  } catch {
    toast.error('Failed to fetch domains')
  } finally {
    loading.value = false
  }
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

// Set status filter
function setStatusFilter(s: string) {
  statusFilter.value = statusFilter.value === s ? '' : s
  page.value = 1
  fetchDomains()
}

// Set drop-within filter
function setDropWithin(days: number) {
  dropWithinFilter.value = dropWithinFilter.value === days ? -1 : days
  page.value = 1
  fetchDomains()
}

// Filters watch
watch([search, selectedTld], () => {
  page.value = 1
  fetchDomains()
})

// Type label
function typeLabel(status: string): string {
  if (status === 'dropped') return t('dropcatch.dropped')
  if (status === 'private_seller') return t('dropcatch.privateSeller')
  if (status === 'pre_release') return t('dropcatch.preRelease')
  if (status === 'pending_delete') return t('dropcatch.pendingDelete')
  return status
}

// Type badge class
function typeBadgeClass(status: string): string {
  if (status === 'dropped') return 'bg-red-100 text-red-700'
  if (status === 'private_seller') return 'bg-purple-100 text-purple-700'
  if (status === 'pre_release') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

// Time formatting — calculated from system time, not stored in DB
function formatEndTime(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  // Show in ET (DropCatch timezone) and local time
  const et = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return `${et} ET`
}

function timeRemaining(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  const diff = d.getTime() - Date.now()
  if (diff <= 0) return t('dropcatch.ended')
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function urgencyClass(d: any): string {
  if (!d.drop_date) return 'text-gray-400'
  const dropDate = new Date(d.drop_date)
  if (isNaN(dropDate.getTime())) return 'text-gray-400'
  const hours = (dropDate.getTime() - Date.now()) / 3600000
  if (hours <= 0) return 'text-gray-400'
  if (hours <= 1) return 'text-red-600 font-bold animate-pulse'
  if (hours <= 6) return 'text-red-500 font-semibold'
  if (hours <= 24) return 'text-orange-500 font-medium'
  return 'text-gray-500'
}

// Navigate to WHOIS page
function goToWhois(domainName: string) {
  window.open(`/whois?domain=${encodeURIComponent(domainName)}`, '_blank')
}

// Copy domain
function copyDomain(name: string) {
  navigator.clipboard.writeText(name)
  toast.success(t('dropcatch.copied'))
}

// Format last refresh time
function formatLastRefresh(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

// Init
onMounted(async () => {
  await fetchDomains()
})
</script>

<template>
  <div class="space-y-4">
    <!-- API Not Configured: full-page unavailable state -->
    <template v-if="!apiConfigured">
      <div class="max-w-lg mx-auto py-20 text-center">
        <Icon name="material-symbols:key-off" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 class="text-xl font-bold text-gray-800 mb-2">{{ t('dropcatch.apiUnavailable') }}</h2>
        <p class="text-sm text-gray-500 mb-4">{{ t('dropcatch.apiUnavailableDesc') }}</p>
        <a
          href="https://www.dropcatch.com/hiw/dropcatch-api"
          target="_blank"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Icon name="material-symbols:open-in-new" class="h-4 w-4" />
          {{ t('dropcatch.apiSignupLink') }}
        </a>
        <p class="text-xs text-gray-400 mt-6">
          DROPCATCH_CLIENT_ID &amp; DROPCATCH_CLIENT_SECRET
        </p>
      </div>
    </template>

    <!-- API Configured: normal view -->
    <template v-else>
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">{{ t('dropcatch.title') }}</h1>
          <p class="text-xs text-gray-400 mt-0.5">
            {{ t('dropcatch.autoUpdate') }}
            <template v-if="lastRefresh">
              &middot; {{ t('dropcatch.lastUpdate') }}: {{ formatLastRefresh(lastRefresh) }}
            </template>
          </p>
        </div>
        <div class="text-sm text-gray-500">
          {{ t('common.total', { n: total }) }}
        </div>
      </div>

      <!-- Filters bar — compact responsive layout -->
      <div class="space-y-2">
        <!-- Row 1: Search + Status tabs + Time filter -->
        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Search (full width on mobile, auto on desktop) -->
          <div class="w-full sm:w-auto sm:flex-none order-first sm:order-none">
            <input
              v-model="search"
              type="text"
              :placeholder="t('dropcatch.searchPlaceholder')"
              class="w-full sm:w-40 lg:w-48 h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white"
            />
          </div>

          <!-- Status tabs -->
          <div class="flex items-center gap-1 overflow-x-auto sm:overflow-visible">
            <button
              :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap', !statusFilter ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
              @click="setStatusFilter('')"
            >
              {{ t('dropcatch.allTypes') }}
            </button>
            <button
              :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap', statusFilter === 'dropped' ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
              @click="setStatusFilter('dropped')"
            >
              {{ t('dropcatch.dropped') }}
            </button>
            <button
              :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap', statusFilter === 'private_seller' ? 'bg-purple-600 text-white border-purple-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
              @click="setStatusFilter('private_seller')"
            >
              {{ t('dropcatch.privateSeller') }}
            </button>
            <button
              :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap', statusFilter === 'pre_release' ? 'bg-amber-600 text-white border-amber-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
              @click="setStatusFilter('pre_release')"
            >
              {{ t('dropcatch.preRelease') }}
            </button>
          </div>

          <span class="hidden lg:inline text-gray-300 mx-0.5">|</span>

          <!-- Time filter -->
          <div class="flex items-center gap-1">
            <button
              :class="['px-2 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 0 ? 'bg-red-50 text-red-700 border-red-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
              @click="setDropWithin(0)"
            >
              {{ t('dropcatch.today') }}
            </button>
            <button
              :class="['px-2 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 3 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
              @click="setDropWithin(3)"
            >
              3d
            </button>
            <button
              :class="['px-2 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 7 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
              @click="setDropWithin(7)"
            >
              7d
            </button>
          </div>
        </div>

        <!-- Row 2: Length buttons + TLD + Sort -->
        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Length buttons -->
          <div class="flex items-center gap-1">
            <button
              v-for="len in [1, 2, 3, 4, 5]"
              :key="len"
              :class="['px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors', lengthFilter === len ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
              @click="setLengthFilter(len)"
            >
              {{ t(`dropcatch.chars${len}`) }}
            </button>
          </div>

          <span class="hidden sm:inline text-gray-300 mx-0.5">|</span>

          <!-- TLD -->
          <select
            v-model="selectedTld"
            class="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white"
          >
            <option value="">{{ t('dropcatch.allTypes') }} TLD</option>
            <option v-for="tldOpt in availableTlds" :key="tldOpt" :value="tldOpt">{{ tldOpt }}</option>
          </select>

          <span class="hidden sm:inline text-gray-300 mx-0.5">|</span>

          <!-- Sort -->
          <div class="flex items-center gap-1">
            <button
              v-for="s in [
                { key: 'drop_date', label: t('dropcatch.sortByDate') },
                { key: 'auction_price', label: t('dropcatch.auctionPrice') },
                { key: 'domain_name', label: t('dropcatch.sortByName') },
              ]"
              :key="s.key"
              :class="['px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors', sortBy === s.key ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
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
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <Icon name="material-symbols:progress-activity" class="h-8 w-8 text-blue-500 animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="domains.length === 0" class="text-center py-20 text-gray-400">
        <Icon name="material-symbols:search-off" class="h-12 w-12 mx-auto mb-3" />
        <p>{{ t('dropcatch.noResults') }}</p>
      </div>

      <!-- Domain cards grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div
          v-for="d in domains"
          :key="d.id"
          class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
          @click="goToWhois(d.domain_name)"
        >
          <!-- Domain name + type badge -->
          <div class="flex items-center justify-between mb-2">
            <span class="font-mono text-lg font-bold text-gray-900 truncate">{{ d.domain_name }}</span>
            <span :class="['inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ml-2', typeBadgeClass(d.status)]">
              {{ typeLabel(d.status) }}
            </span>
          </div>

          <!-- Price + bidders -->
          <div class="flex items-center justify-between mb-2">
            <span v-if="d.auction_price" class="text-blue-600 font-bold">${{ d.auction_price }}</span>
            <span v-else class="text-gray-300 text-sm">-</span>
            <span v-if="d.registrar" class="text-xs text-gray-400">{{ d.registrar }}</span>
          </div>

          <!-- End time + remaining -->
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>{{ formatEndTime(d.drop_date) }}</span>
            <span :class="urgencyClass(d)">{{ timeRemaining(d.drop_date) }}</span>
          </div>
        </div>
      </div>

      <!-- Hint: click for WHOIS -->
      <div v-if="domains.length > 0" class="text-center text-xs text-gray-400">
        {{ t('dropcatch.clickForWhois') }}
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between">
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
    </template>
  </div>
</template>
