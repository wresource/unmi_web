<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t } = useI18n()
const route = useRoute()
const domainName = computed(() => decodeURIComponent(route.params.name as string))

const { data: result, error } = await useFetch(`/api/show/domains/${encodeURIComponent(domainName.value)}`)

const domain = computed(() => result.value?.data)
const related = computed(() => result.value?.data?.related || [])

useHead({
  title: computed(() => domain.value ? `${domain.value.domain_name} - UNMI.IO` : 'UNMI.IO'),
  meta: [
    { name: 'description', content: computed(() => domain.value?.show_description || `${domainName.value}`) },
  ],
})

const showInquiry = ref(false)

const displayPrice = computed(() => {
  if (!domain.value || domain.value.price_type === 'inquiry' || !domain.value.show_price) {
    return null
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(domain.value.show_price)
})

function openInquiry() {
  showInquiry.value = true
}

function onInquirySuccess() {
  showInquiry.value = false
}

async function shareDomain() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    alert(t('common.copied'))
  } catch {
    // Fallback
  }
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <!-- Error state -->
    <div v-if="error || !domain" class="max-w-7xl mx-auto px-4 py-20 text-center">
      <Icon name="material-symbols:error-outline" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h2 class="text-xl font-bold text-gray-900 mb-2">{{ t('show.market.noResults') }}</h2>
      <p class="text-gray-500 mb-6">{{ t('show.market.tryOther') }}</p>
      <NuxtLink
        to="/show/domains"
        class="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        {{ t('show.market.title') }}
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Top section -->
      <div class="bg-white border-b border-gray-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <!-- Breadcrumb -->
          <nav class="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <NuxtLink to="/show" class="hover:text-gray-700 transition-colors">{{ t('show.footer.home') }}</NuxtLink>
            <Icon name="material-symbols:chevron-right" class="h-4 w-4" />
            <NuxtLink to="/show/domains" class="hover:text-gray-700 transition-colors">{{ t('show.market.title') }}</NuxtLink>
            <Icon name="material-symbols:chevron-right" class="h-4 w-4" />
            <span class="text-gray-900">{{ domain.domain_name }}</span>
          </nav>

          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              {{ domain.domain_name }}
            </h1>
            <span
              v-if="domain.is_featured"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-sm font-medium"
            >
              <Icon name="material-symbols:star" class="h-4 w-4" />
              {{ t('showcase.featured') }}
            </span>
            <span
              v-if="domain.category_name"
              class="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium"
            >
              {{ domain.category_name }}
            </span>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div class="flex flex-col lg:flex-row gap-8">
          <!-- Left column -->
          <div class="flex-1 min-w-0 space-y-8">
            <!-- Description -->
            <div v-if="domain.show_description" class="bg-white rounded-xl border border-gray-200 p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-3">{{ t('showcase.description') }}</h2>
              <p class="text-gray-600 leading-relaxed">{{ domain.show_description }}</p>
            </div>

            <!-- Value Analysis -->
            <div class="bg-white rounded-xl border border-gray-200 p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ t('domains.domainName') }}</h2>
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 rounded-lg bg-gray-50">
                  <div class="text-sm text-gray-500 mb-1">TLD</div>
                  <div class="font-semibold text-gray-900">{{ domain.tld || '--' }}</div>
                </div>
                <div class="p-4 rounded-lg bg-gray-50">
                  <div class="text-sm text-gray-500 mb-1">{{ t('show.market.lengthRange') }}</div>
                  <div class="font-semibold text-gray-900">
                    {{ domain.domain_name.split('.')[0]?.length || 0 }}
                  </div>
                </div>
                <div class="p-4 rounded-lg bg-gray-50">
                  <div class="text-sm text-gray-500 mb-1">{{ t('showcase.priceType') }}</div>
                  <div class="font-semibold text-gray-900">
                    {{ domain.price_type === 'fixed' ? t('showcase.fixedPrice') : t('showcase.inquiry') }}
                  </div>
                </div>
                <div class="p-4 rounded-lg bg-gray-50">
                  <div class="text-sm text-gray-500 mb-1">{{ t('show.detail.views') }}</div>
                  <div class="font-semibold text-gray-900">{{ domain.view_count || 0 }}</div>
                </div>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="domain.tags?.length" class="bg-white rounded-xl border border-gray-200 p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-3">{{ t('domains.tags') }}</h2>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in domain.tags"
                  :key="tag"
                  class="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right column - Price card -->
          <div class="lg:w-96 shrink-0">
            <div class="sticky top-24 space-y-4">
              <div class="bg-white rounded-xl border border-gray-200 p-6">
                <!-- Price -->
                <div class="text-center mb-6">
                  <div v-if="displayPrice" class="text-3xl font-bold text-blue-600 mb-1">
                    {{ displayPrice }}
                  </div>
                  <div v-else class="text-2xl font-bold text-gray-900 mb-1">
                    {{ t('show.detail.makeOffer') }}
                  </div>
                  <p class="text-sm text-gray-500">
                    {{ displayPrice ? t('showcase.fixedPrice') : t('showcase.inquiry') }}
                  </p>
                </div>

                <!-- CTA Buttons -->
                <div class="space-y-3">
                  <button
                    class="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    @click="openInquiry"
                  >
                    {{ t('show.detail.makeOffer') }}
                  </button>
                  <NuxtLink
                    :to="{ path: '/show/inquiry', query: { domain: domain.domain_name } }"
                    class="flex items-center justify-center w-full h-12 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    {{ t('show.detail.contactAdvisor') }}
                  </NuxtLink>
                </div>
              </div>

              <!-- Share -->
              <button
                class="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-gray-700 hover:bg-white transition-colors"
                @click="shareDomain"
              >
                <Icon name="material-symbols:share" class="h-4 w-4" />
                {{ t('show.detail.share') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Related domains -->
        <div v-if="related.length" class="mt-16">
          <h2 class="text-2xl font-bold text-gray-900 mb-6">{{ t('show.detail.relatedDomains') }}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <ShowDomainCard
              v-for="d in related.slice(0, 8)"
              :key="d.domain_name"
              :domain="d"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Inquiry Modal -->
    <ShowInquiryModal
      :visible="showInquiry"
      :domain-name="domain?.domain_name"
      @close="showInquiry = false"
      @success="onInquirySuccess"
    />
  </div>
</template>
