<script setup lang="ts">
interface Props {
  icon: string
  title: string
  value: string | number
  trend?: number
  trendLabel?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'blue',
  trend: undefined,
  trendLabel: undefined,
})

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    accent: 'border-l-blue-500',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    accent: 'border-l-green-500',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    accent: 'border-l-red-500',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    accent: 'border-l-yellow-500',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    accent: 'border-l-purple-500',
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    accent: 'border-l-indigo-500',
  },
}

const colors = computed(() => colorMap[props.color])
</script>

<template>
  <div
    :class="[
      'rounded-xl border border-gray-200 bg-white p-5 shadow-sm card-hover border-l-4',
      colors.accent,
    ]"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-500">{{ title }}</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">{{ value }}</p>
        <div v-if="trend !== undefined" class="mt-2 flex items-center gap-1 text-xs">
          <Icon
            :name="trend >= 0 ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'"
            class="h-3.5 w-3.5"
            :class="trend >= 0 ? 'text-green-500' : 'text-red-500'"
          />
          <span :class="trend >= 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">
            {{ Math.abs(trend) }}%
          </span>
          <span v-if="trendLabel" class="text-gray-400">{{ trendLabel }}</span>
        </div>
      </div>
      <div
        :class="[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          colors.bg,
        ]"
      >
        <Icon :name="icon" :class="['h-6 w-6', colors.icon]" />
      </div>
    </div>
  </div>
</template>
