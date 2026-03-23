<script setup lang="ts">
interface Props {
  expireDate: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const days = computed(() => {
  const now = new Date()
  const expire = new Date(props.expireDate)
  const diff = expire.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const colorClass = computed(() => {
  if (days.value < 0) return 'text-gray-500'
  if (days.value <= 7) return 'text-red-600'
  if (days.value <= 30) return 'text-orange-500'
  return 'text-green-600'
})

const bgClass = computed(() => {
  if (days.value < 0) return 'bg-gray-50'
  if (days.value <= 7) return 'bg-red-50'
  if (days.value <= 30) return 'bg-orange-50'
  return 'bg-green-50'
})

const label = computed(() => {
  if (days.value < 0) return t('daysRemaining.expired', { n: Math.abs(days.value) })
  if (days.value === 0) return t('daysRemaining.today')
  return t('daysRemaining.days', { n: days.value })
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap',
      colorClass,
      bgClass,
    ]"
  >
    <Icon
      v-if="days <= 7 && days >= 0"
      name="material-symbols:warning"
      class="h-3.5 w-3.5"
    />
    {{ label }}
  </span>
</template>
