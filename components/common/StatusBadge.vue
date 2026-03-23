<script setup lang="ts">
interface Props {
  status: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const statusConfig = computed(() => ({
  active: {
    label: t('domains.status.active'),
    classes: 'bg-green-50 text-green-700 ring-green-600/20',
  },
  expired: {
    label: t('domains.status.expired'),
    classes: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  sold: {
    label: t('domains.status.sold'),
    classes: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  parking: {
    label: t('domains.status.parking'),
    classes: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  },
  pending: {
    label: t('domains.status.pending'),
    classes: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  },
  transferring: {
    label: t('domains.status.transferring'),
    classes: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  pending_delete: {
    label: t('domains.status.pending_delete'),
    classes: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
  redemption: {
    label: t('domains.status.redemption'),
    classes: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  reserved: {
    label: t('domains.status.reserved'),
    classes: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
} as Record<string, { label: string; classes: string }>))

const config = computed(() => {
  return statusConfig.value[props.status] || {
    label: props.status,
    classes: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      config.classes,
    ]"
  >
    {{ config.label }}
  </span>
</template>
