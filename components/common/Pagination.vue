<script setup lang="ts">
interface Props {
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const current = props.page
  const last = totalPages.value

  if (last <= 7) {
    for (let i = 1; i <= last; i++) pages.push(i)
    return pages
  }

  pages.push(1)
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < last - 2) pages.push('...')
  pages.push(last)

  return pages
})

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value && page !== props.page) {
    emit('update:page', page)
  }
}

function changePageSize(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value)
  emit('update:pageSize', size)
  emit('update:page', 1)
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
    <!-- Info -->
    <div class="text-sm text-gray-500">
      {{ t('common.pageInfo', { total, page, totalPages }) }}
    </div>

    <div class="flex items-center gap-3">
      <!-- Page size selector -->
      <div class="flex items-center gap-2 text-sm">
        <span class="text-gray-500">{{ t('common.perPage') }}</span>
        <select
          :value="pageSize"
          class="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 input-focus"
          @change="changePageSize"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
        <span class="text-gray-500">{{ t('common.items') }}</span>
      </div>

      <!-- Page buttons -->
      <nav class="flex items-center gap-1">
        <!-- Previous -->
        <button
          :disabled="page <= 1"
          class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          @click="goToPage(page - 1)"
        >
          <Icon name="material-symbols:chevron-left" class="h-4 w-4" />
        </button>

        <!-- Page numbers -->
        <template v-for="(p, index) in visiblePages" :key="index">
          <span v-if="p === '...'" class="flex h-8 w-8 items-center justify-center text-sm text-gray-400">
            ...
          </span>
          <button
            v-else
            :class="[
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
              p === page
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            ]"
            @click="goToPage(p as number)"
          >
            {{ p }}
          </button>
        </template>

        <!-- Next -->
        <button
          :disabled="page >= totalPages"
          class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          @click="goToPage(page + 1)"
        >
          <Icon name="material-symbols:chevron-right" class="h-4 w-4" />
        </button>
      </nav>
    </div>
  </div>
</template>
