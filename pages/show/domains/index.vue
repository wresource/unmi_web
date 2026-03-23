<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t } = useI18n()

useHead({
  title: computed(() => `${t('show.market.title')} - UNMI.IO`),
  meta: [
    { name: 'description', content: computed(() => t('show.heroSubtitle')) },
  ],
})

const route = useRoute()
const router = useRouter()

// Filters
const search = ref((route.query.search as string) || '')
const selectedTlds = ref<string[]>([])
const selectedCategory = ref(route.query.category ? Number(route.query.category) : 0)
const priceMin = ref('')
const priceMax = ref('')
const lengthMin = ref('')
const lengthMax = ref('')
const priceType = ref('')
const sort = ref('recommended')
const page = ref(1)
const pageSize = 20

const filtersOpen = ref(false)

const sortOptions = computed(() => [
  { value: 'recommended', label: t('show.market.recommended') },
  { value: 'newest', label: t('show.market.newest') },
  { value: 'price_asc', label: t('show.market.priceAsc') },
  { value: 'price_desc', label: t('show.market.priceDesc') },
  { value: 'length', label: t('show.market.lengthAsc') },
])

const commonTlds = ['.com', '.cn', '.net', '.io', '.ai', '.cc', '.co', '.org', '.top', '.xyz']

// Fetch categories
const { data: categoriesData } = await useFetch('/api/show/categories')

// Build query params
const queryParams = computed(() => {
  const p: Record<string, any> = {
    page: page.value,
    pageSize,
    sort: sort.value,
  }
  if (search.value) p.search = search.value
  if (selectedTlds.value.length === 1) p.tld = selectedTlds.value[0]
  if (selectedCategory.value) p.category = selectedCategory.value
  if (priceMin.value) p.price_min = priceMin.value
  if (priceMax.value) p.price_max = priceMax.value
  if (lengthMin.value) p.length_min = lengthMin.value
  if (lengthMax.value) p.length_max = lengthMax.value
  if (priceType.value) p.price_type = priceType.value
  return p
})

const { data: result, pending, refresh } = await useFetch('/api/show/domains', {
  query: queryParams,
  watch: [queryParams],
})

const domains = computed(() => result.value?.data || [])
const total = computed(() => result.value?.total || 0)
const totalPages = computed(() => Math.ceil(total.value / pageSize))

function handleSearch(q: string) {
  search.value = q
  page.value = 1
}

function toggleTld(tld: string) {
  const idx = selectedTlds.value.indexOf(tld)
  if (idx >= 0) {
    selectedTlds.value.splice(idx, 1)
  } else {
    selectedTlds.value = [tld]
  }
  page.value = 1
}

function resetFilters() {
  search.value = ''
  selectedTlds.value = []
  selectedCategory.value = 0
  priceMin.value = ''
  priceMax.value = ''
  lengthMin.value = ''
  lengthMax.value = ''
  priceType.value = ''
  sort.value = 'recommended'
  page.value = 1
}

function goToPage(p: number) {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const visiblePages = computed(() => {
  const pages: number[] = []
  const tp = totalPages.value
  const cp = page.value
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) pages.push(i)
  } else {
    pages.push(1)
    if (cp > 3) pages.push(-1)
    const start = Math.max(2, cp - 1)
    const end = Math.min(tp - 1, cp + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (cp < tp - 2) pages.push(-1)
    pages.push(tp)
  }
  return pages
})

const hasActiveFilters = computed(() => {
  return selectedTlds.value.length > 0 || selectedCategory.value > 0 ||
    priceMin.value || priceMax.value || lengthMin.value || lengthMax.value || priceType.value
})
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <div class="bg-white border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-4">{{ t('show.market.title') }}</h1>
        <div class="max-w-2xl">
          <ShowSearchBar
            v-model="search"
            size="md"
            @search="handleSearch"
          />
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Filters Sidebar -->
        <aside class="lg:w-64 shrink-0">
          <!-- Mobile toggle -->
          <button
            class="lg:hidden flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 mb-4"
            @click="filtersOpen = !filtersOpen"
          >
            <Icon name="material-symbols:filter-list" class="h-4 w-4" />
            {{ t('show.market.filters') }}
            <Icon
              :name="filtersOpen ? 'material-symbols:expand-less' : 'material-symbols:expand-more'"
              class="h-4 w-4 ml-auto"
            />
          </button>

          <div :class="['space-y-6', filtersOpen ? 'block' : 'hidden lg:block']">
            <!-- TLD Filter -->
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('show.market.tldFilter') }}</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tld in commonTlds"
                  :key="tld"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    selectedTlds.includes(tld)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ]"
                  @click="toggleTld(tld)"
                >
                  {{ tld }}
                </button>
              </div>
            </div>

            <!-- Category Filter -->
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('show.market.categoryFilter') }}</h3>
              <select
                v-model="selectedCategory"
                class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus bg-white"
                @change="page = 1"
              >
                <option :value="0">{{ t('common.all') }}</option>
                <option
                  v-for="cat in categoriesData?.data"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Price Range -->
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('show.market.priceRange') }}</h3>
              <div class="flex items-center gap-2">
                <input
                  v-model="priceMin"
                  type="number"
                  :placeholder="t('show.market.minPrice')"
                  class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                  @change="page = 1"
                />
                <span class="text-gray-400">-</span>
                <input
                  v-model="priceMax"
                  type="number"
                  :placeholder="t('show.market.maxPrice')"
                  class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                  @change="page = 1"
                />
              </div>
            </div>

            <!-- Length Range -->
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('show.market.lengthRange') }}</h3>
              <div class="flex items-center gap-2">
                <input
                  v-model="lengthMin"
                  type="number"
                  :placeholder="t('show.market.minLength')"
                  class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                  @change="page = 1"
                />
                <span class="text-gray-400">-</span>
                <input
                  v-model="lengthMax"
                  type="number"
                  :placeholder="t('show.market.maxLength')"
                  class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                  @change="page = 1"
                />
              </div>
            </div>

            <!-- Price Type -->
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">{{ t('show.market.priceTypeFilter') }}</h3>
              <select
                v-model="priceType"
                class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus bg-white"
                @change="page = 1"
              >
                <option value="">{{ t('show.market.allTypes') }}</option>
                <option value="fixed">{{ t('showcase.fixedPrice') }}</option>
                <option value="inquiry">{{ t('showcase.inquiry') }}</option>
              </select>
            </div>

            <!-- Reset -->
            <button
              v-if="hasActiveFilters"
              class="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              @click="resetFilters"
            >
              {{ t('common.reset') }}
            </button>
          </div>
        </aside>

        <!-- Results -->
        <div class="flex-1 min-w-0">
          <!-- Toolbar -->
          <div class="flex items-center justify-between mb-6">
            <p class="text-sm text-gray-500">
              {{ t('common.total', { n: total }) }}
            </p>
            <select
              v-model="sort"
              class="h-9 px-3 pr-8 rounded-lg border border-gray-200 text-sm input-focus bg-white"
              @change="page = 1"
            >
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Loading -->
          <div v-if="pending" class="flex items-center justify-center py-20">
            <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>

          <!-- Empty -->
          <div v-else-if="domains.length === 0" class="text-center py-20">
            <Icon name="material-symbols:search-off" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">{{ t('show.market.noResults') }}</h3>
            <p class="text-gray-500 mb-6">{{ t('show.market.tryOther') }}</p>
            <button
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              @click="resetFilters"
            >
              {{ t('common.reset') }}
            </button>
          </div>

          <!-- Grid -->
          <div v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              <ShowDomainCard
                v-for="domain in domains"
                :key="domain.domain_name"
                :domain="domain"
              />
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex items-center justify-center gap-1 mt-10">
              <button
                :disabled="page <= 1"
                class="h-9 w-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                @click="goToPage(page - 1)"
              >
                <Icon name="material-symbols:chevron-left" class="h-5 w-5" />
              </button>
              <template v-for="(p, i) in visiblePages" :key="i">
                <span v-if="p === -1" class="px-1 text-gray-400">...</span>
                <button
                  v-else
                  :class="[
                    'h-9 min-w-[36px] px-2 rounded-lg text-sm font-medium transition-colors',
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200',
                  ]"
                  @click="goToPage(p)"
                >
                  {{ p }}
                </button>
              </template>
              <button
                :disabled="page >= totalPages"
                class="h-9 w-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                @click="goToPage(page + 1)"
              >
                <Icon name="material-symbols:chevron-right" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
