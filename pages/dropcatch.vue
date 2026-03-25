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

// WHOIS modal
const showWhoisModal = ref(false)
const whoisDomain = ref('')
const whoisLoading = ref(false)
const whoisData = ref<any>(null)
const whoisError = ref('')

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
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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

// WHOIS popup
async function showWhois(domainName: string) {
  whoisDomain.value = domainName
  whoisData.value = null
  whoisError.value = ''
  whoisLoading.value = true
  showWhoisModal.value = true

  try {
    const res = await $fetch<any>('/api/whois/query', {
      method: 'POST',
      body: { domain: domainName },
    })
    whoisData.value = res
  } catch (err: any) {
    whoisError.value = err?.data?.statusMessage || err?.message || 'WHOIS query failed'
  } finally {
    whoisLoading.value = false
  }
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

      <!-- Filters bar — horizontal, compact, mobile-friendly -->
      <div class="space-y-2">
        <!-- Row 1: Status tabs -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', !statusFilter ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
            @click="setStatusFilter('')"
          >
            {{ t('dropcatch.allTypes') }}
          </button>
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', statusFilter === 'dropped' ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
            @click="setStatusFilter('dropped')"
          >
            {{ t('dropcatch.dropped') }}
          </button>
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', statusFilter === 'private_seller' ? 'bg-purple-600 text-white border-purple-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
            @click="setStatusFilter('private_seller')"
          >
            {{ t('dropcatch.privateSeller') }}
          </button>
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', statusFilter === 'pre_release' ? 'bg-amber-600 text-white border-amber-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50']"
            @click="setStatusFilter('pre_release')"
          >
            {{ t('dropcatch.preRelease') }}
          </button>

          <span class="hidden sm:inline text-gray-300 mx-1">|</span>

          <!-- Length buttons -->
          <button
            v-for="len in [1, 2, 3, 4, 5]"
            :key="len"
            :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors', lengthFilter === len ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
            @click="setLengthFilter(len)"
          >
            {{ t(`dropcatch.chars${len}`) }}
          </button>
        </div>

        <!-- Row 2: TLD + Time + Search + Sort -->
        <div class="flex flex-wrap items-center gap-1.5">
          <!-- TLD -->
          <select
            v-model="selectedTld"
            class="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white"
          >
            <option value="">{{ t('dropcatch.allTypes') }} TLD</option>
            <option v-for="tldOpt in availableTlds" :key="tldOpt" :value="tldOpt">{{ tldOpt }}</option>
          </select>

          <!-- Time filter -->
          <button
            :class="['px-2.5 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 0 ? 'bg-red-50 text-red-700 border-red-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
            @click="setDropWithin(0)"
          >
            {{ t('dropcatch.today') }}
          </button>
          <button
            :class="['px-2.5 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 3 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
            @click="setDropWithin(3)"
          >
            3d
          </button>
          <button
            :class="['px-2.5 py-1.5 text-xs rounded-lg border transition-colors', dropWithinFilter === 7 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
            @click="setDropWithin(7)"
          >
            7d
          </button>

          <span class="hidden sm:inline text-gray-300 mx-1">|</span>

          <!-- Sort -->
          <button
            v-for="s in [
              { key: 'drop_date', label: t('dropcatch.sortByDate') },
              { key: 'auction_price', label: t('dropcatch.auctionPrice') },
              { key: 'domain_name', label: t('dropcatch.sortByName') },
            ]"
            :key="s.key"
            :class="['px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors', sortBy === s.key ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50']"
            @click="setSort(s.key)"
          >
            {{ s.label }}
            <Icon
              v-if="sortBy === s.key"
              :name="sortOrder === 'ASC' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
              class="h-3 w-3 inline ml-0.5"
            />
          </button>

          <!-- Search -->
          <div class="flex-1 min-w-[120px]">
            <input
              v-model="search"
              type="text"
              :placeholder="t('dropcatch.searchPlaceholder')"
              class="w-full h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white"
            />
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
          @click="showWhois(d.domain_name)"
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

    <!-- WHOIS Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showWhoisModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          @click.self="showWhoisModal = false"
        >
          <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 class="text-lg font-semibold text-gray-900">WHOIS: {{ whoisDomain }}</h3>
              <button class="text-gray-400 hover:text-gray-600" @click="showWhoisModal = false">
                <Icon name="material-symbols:close" class="h-5 w-5" />
              </button>
            </div>

            <!-- Loading -->
            <div v-if="whoisLoading" class="flex items-center justify-center py-12">
              <Icon name="material-symbols:progress-activity" class="h-6 w-6 text-blue-500 animate-spin" />
            </div>

            <!-- Error -->
            <div v-else-if="whoisError" class="p-5 text-center">
              <Icon name="material-symbols:error-outline" class="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p class="text-sm text-red-600">{{ whoisError }}</p>
            </div>

            <!-- WHOIS data -->
            <div v-else-if="whoisData" class="p-5 space-y-3 text-sm">
              <div v-if="whoisData.registrar" class="flex justify-between">
                <span class="text-gray-500">Registrar</span>
                <span class="text-gray-900 font-medium">{{ whoisData.registrar }}</span>
              </div>
              <div v-if="whoisData.creationDate" class="flex justify-between">
                <span class="text-gray-500">Created</span>
                <span class="text-gray-900">{{ whoisData.creationDate?.split('T')[0] }}</span>
              </div>
              <div v-if="whoisData.expirationDate" class="flex justify-between">
                <span class="text-gray-500">Expires</span>
                <span class="text-gray-900">{{ whoisData.expirationDate?.split('T')[0] }}</span>
              </div>
              <div v-if="whoisData.updatedDate" class="flex justify-between">
                <span class="text-gray-500">Updated</span>
                <span class="text-gray-900">{{ whoisData.updatedDate?.split('T')[0] }}</span>
              </div>
              <div v-if="whoisData.nameServers?.length" class="flex justify-between">
                <span class="text-gray-500">Name Servers</span>
                <span class="text-gray-900 text-right">{{ whoisData.nameServers.join(', ') }}</span>
              </div>
              <div v-if="whoisData.status?.length">
                <span class="text-gray-500 block mb-1">Status</span>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="s in whoisData.status"
                    :key="s"
                    class="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
                  >{{ s }}</span>
                </div>
              </div>
              <div v-if="whoisData.registrantName" class="flex justify-between">
                <span class="text-gray-500">Registrant</span>
                <span class="text-gray-900">{{ whoisData.registrantName }}</span>
              </div>
              <div v-if="whoisData.registrantEmail" class="flex justify-between">
                <span class="text-gray-500">Email</span>
                <span class="text-gray-900">{{ whoisData.registrantEmail }}</span>
              </div>

              <!-- Raw WHOIS toggle -->
              <details v-if="whoisData.rawText" class="mt-4">
                <summary class="text-xs text-blue-600 cursor-pointer hover:underline">Raw WHOIS</summary>
                <pre class="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-60">{{ whoisData.rawText }}</pre>
              </details>
            </div>

            <!-- Actions -->
            <div class="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                class="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                @click="copyDomain(whoisDomain)"
              >
                {{ t('dropcatch.copyDomain') }}
              </button>
              <button
                class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                @click="showWhoisModal = false"
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
