<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  width?: string
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: 'max-w-lg',
  persistent: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  if (!props.persistent) {
    emit('update:modelValue', false)
  }
}

function onBackdropClick() {
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="onBackdropClick"
        />

        <!-- Modal content -->
        <div
          :class="['modal-content relative w-full rounded-xl bg-white shadow-2xl', width]"
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <slot name="header">
              <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
            </slot>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              @click="emit('update:modelValue', false)"
            >
              <Icon name="material-symbols:close" class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
