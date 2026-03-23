<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t, isZh } = useI18n()

useHead({
  title: computed(() => `UNMI.IO - ${t('show.heroTitle')}`),
  meta: [
    { name: 'description', content: computed(() => t('show.heroSubtitle')) },
  ],
})

const router = useRouter()
const searchQuery = ref('')

const hotKeywords = computed(() => isZh.value
  ? ['AI', '科技', '金融', '电商', '短域名', '双拼', '三字母']
  : ['AI', 'Tech', 'Finance', 'E-commerce', 'Short', 'Brand', 'Premium']
)

const { data: stats } = await useFetch('/api/show/stats')
const { data: featured } = await useFetch('/api/show/featured')
const { data: categories } = await useFetch('/api/show/categories')

function handleSearch(q: string) {
  router.push({ path: '/show/domains', query: { search: q } })
}

function searchKeyword(keyword: string) {
  router.push({ path: '/show/domains', query: { search: keyword } })
}
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 overflow-hidden">
      <!-- Background decoration -->
      <div class="absolute inset-0">
        <div class="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div class="text-center max-w-3xl mx-auto">
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            {{ t('show.heroTitle') }}
          </h1>
          <p class="text-lg sm:text-xl text-blue-100 mb-10">
            {{ t('show.heroSubtitle') }}
          </p>

          <!-- Search Bar -->
          <div class="max-w-2xl mx-auto mb-6">
            <ShowSearchBar
              v-model="searchQuery"
              size="lg"
              @search="handleSearch"
            />
          </div>

          <!-- Hot Keywords -->
          <div class="flex items-center justify-center flex-wrap gap-2">
            <span class="text-blue-200 text-sm mr-1">{{ t('show.hotKeywords') }}:</span>
            <button
              v-for="kw in hotKeywords"
              :key="kw"
              class="px-3 py-1 rounded-full bg-white/10 text-blue-100 text-sm hover:bg-white/20 transition-colors"
              @click="searchKeyword(kw)"
            >
              {{ kw }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="bg-white border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <div class="text-2xl sm:text-3xl font-bold text-gray-900">
              {{ stats?.data?.total_domains ?? '--' }}
            </div>
            <div class="text-sm text-gray-500 mt-1">{{ t('show.domainsAvailable') }}</div>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-bold text-gray-900">
              {{ stats?.data?.active_categories ?? '--' }}
            </div>
            <div class="text-sm text-gray-500 mt-1">{{ t('show.categoriesCount') }}</div>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-bold text-gray-900">
              {{ stats?.data?.featured_count ?? '--' }}
            </div>
            <div class="text-sm text-gray-500 mt-1">{{ t('show.featuredCount') }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Domains -->
    <section class="bg-gray-50 py-16 sm:py-20" v-if="featured?.data?.length">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 mb-3">{{ t('show.featuredDomains') }}</h2>
          <p class="text-gray-500">{{ t('show.heroSubtitle') }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <ShowDomainCard
            v-for="domain in featured.data.slice(0, 8)"
            :key="domain.domain_name"
            :domain="domain"
          />
        </div>
        <div class="text-center mt-10">
          <NuxtLink
            to="/show/domains"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-white hover:border-gray-400 transition-colors"
          >
            {{ t('show.premiumDomains') }}
            <Icon name="material-symbols:arrow-forward" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Categories -->
    <section class="bg-white py-16 sm:py-20" v-if="categories?.data?.length">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 mb-3">{{ t('show.categories') }}</h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NuxtLink
            v-for="cat in categories.data"
            :key="cat.id"
            :to="{ path: '/show/domains', query: { category: cat.id } }"
            class="group p-6 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div class="flex items-start justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {{ cat.name }}
              </h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                {{ cat.domain_count ?? 0 }}
              </span>
            </div>
            <p class="text-sm text-gray-500 leading-relaxed">
              {{ cat.description || '' }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-gradient-to-br from-blue-600 to-indigo-700 py-16 sm:py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-bold text-white mb-4">{{ t('show.ctaTitle') }}</h2>
        <p class="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
          {{ t('show.ctaSubtitle') }}
        </p>
        <NuxtLink
          to="/show/inquiry"
          class="inline-flex items-center px-8 py-3.5 rounded-xl bg-white text-blue-700 font-semibold text-base hover:bg-blue-50 transition-colors shadow-lg"
        >
          {{ t('show.ctaButton') }}
          <Icon name="material-symbols:arrow-forward" class="h-5 w-5 ml-2" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
