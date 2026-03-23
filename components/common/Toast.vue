<script setup lang="ts">
const { toasts, remove } = useToast()

const iconMap: Record<string, string> = {
  success: 'material-symbols:check-circle',
  error: 'material-symbols:error',
  info: 'material-symbols:info',
  warning: 'material-symbols:warning',
}

const colorMap: Record<string, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
}

const iconColorMap: Record<string, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-yellow-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-80">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm',
            colorMap[toast.type],
          ]"
        >
          <Icon
            :name="iconMap[toast.type]"
            :class="['h-5 w-5 shrink-0 mt-0.5', iconColorMap[toast.type]]"
          />
          <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>
          <button
            class="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            @click="remove(toast.id)"
          >
            <Icon name="material-symbols:close" class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
