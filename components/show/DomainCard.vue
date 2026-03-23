<script setup lang="ts">
const props = defineProps<{
  domain: {
    domain_name: string
    tld?: string
    show_price?: number
    price_type?: string
    show_description?: string
    is_featured?: number | boolean
    category_name?: string
    tags?: string[]
  }
}>()

const router = useRouter()
const { t } = useI18n()

const displayPrice = computed(() => {
  if (props.domain.price_type === 'inquiry' || !props.domain.show_price) {
    return null
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(props.domain.show_price)
})

const isFeatured = computed(() => {
  return !!props.domain.is_featured
})

function goToDetail() {
  router.push(`/show/domains/${encodeURIComponent(props.domain.domain_name)}`)
}
</script>

<template>
  <div
    class="group relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    @click="goToDetail"
  >
    <!-- Featured badge -->
    <div
      v-if="isFeatured"
      class="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium"
    >
      <Icon name="material-symbols:star" class="h-3.5 w-3.5" />
      {{ t('showcase.featured') }}
    </div>

    <!-- Domain name -->
    <h3 class="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors pr-16">
      {{ domain.domain_name }}
    </h3>

    <!-- TLD badge + Category -->
    <div class="flex items-center gap-2 mb-3">
      <span
        v-if="domain.tld"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
      >
        {{ domain.tld }}
      </span>
      <span
        v-if="domain.category_name"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
      >
        {{ domain.category_name }}
      </span>
    </div>

    <!-- Description -->
    <p
      v-if="domain.show_description"
      class="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed"
    >
      {{ domain.show_description }}
    </p>
    <div v-else class="mb-4" />

    <!-- Bottom: Price + Action -->
    <div class="flex items-center justify-between pt-3 border-t border-gray-100">
      <div>
        <span v-if="displayPrice" class="text-lg font-bold text-blue-600">
          {{ displayPrice }}
        </span>
        <span
          v-else
          class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium"
        >
          {{ t('showcase.inquiry') }}
        </span>
      </div>
      <span class="text-sm text-gray-400 group-hover:text-blue-500 transition-colors flex items-center gap-1">
        {{ t('common.viewDetail') }}
        <Icon name="material-symbols:arrow-forward" class="h-4 w-4" />
      </span>
    </div>
  </div>
</template>
