<script setup lang="ts">
const { t } = useI18n()

interface Props {
  modelValue: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: 'blue' | 'red' | 'green'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  message: undefined,
  confirmText: undefined,
  cancelText: undefined,
  confirmColor: 'blue',
  loading: false,
})

const computedTitle = computed(() => props.title ?? t('common.confirm'))
const computedMessage = computed(() => props.message ?? t('common.confirm'))
const computedConfirmText = computed(() => props.confirmText ?? t('common.confirm'))
const computedCancelText = computed(() => props.cancelText ?? t('common.cancel'))

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const confirmBtnClass = computed(() => {
  const map = {
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20',
    red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500/20',
    green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500/20',
  }
  return map[props.confirmColor]
})

function cancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <CommonModal :model-value="modelValue" :title="computedTitle" width="max-w-md" persistent @update:model-value="emit('update:modelValue', $event)">
    <div class="flex items-start gap-4">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50">
        <Icon name="material-symbols:warning" class="h-5 w-5 text-yellow-600" />
      </div>
      <p class="text-sm text-gray-600 leading-relaxed pt-2">{{ computedMessage }}</p>
    </div>

    <template #footer>
      <button
        class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
        :disabled="loading"
        @click="cancel"
      >
        {{ computedCancelText }}
      </button>
      <button
        :class="[
          'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 disabled:opacity-60',
          confirmBtnClass,
        ]"
        :disabled="loading"
        @click="confirm"
      >
        <Icon v-if="loading" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin mr-1 inline" />
        {{ computedConfirmText }}
      </button>
    </template>
  </CommonModal>
</template>
