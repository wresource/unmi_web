<script setup lang="ts">
const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue?: string
  size?: 'lg' | 'md'
}>(), {
  modelValue: '',
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [value: string]
}>()

const query = ref(props.modelValue)

watch(() => props.modelValue, (v) => {
  query.value = v
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  query.value = val
  emit('update:modelValue', val)
}

function onSubmit() {
  emit('search', query.value)
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex w-full">
    <div class="relative flex-1">
      <Icon
        name="material-symbols:search"
        :class="[
          'absolute left-4 top-1/2 -translate-y-1/2 text-gray-400',
          size === 'lg' ? 'h-6 w-6' : 'h-5 w-5',
        ]"
      />
      <input
        type="text"
        :value="query"
        @input="onInput"
        :placeholder="t('show.searchPlaceholder')"
        :class="[
          'w-full border border-gray-200 bg-white text-gray-900 placeholder-gray-400 outline-none transition-all',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          size === 'lg'
            ? 'h-14 pl-12 pr-4 text-lg rounded-l-xl'
            : 'h-11 pl-11 pr-4 text-sm rounded-l-lg',
        ]"
      />
    </div>
    <button
      type="submit"
      :class="[
        'shrink-0 bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors',
        size === 'lg'
          ? 'px-8 text-base rounded-r-xl'
          : 'px-5 text-sm rounded-r-lg',
      ]"
    >
      {{ t('common.search') }}
    </button>
  </form>
</template>
