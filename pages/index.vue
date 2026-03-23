<script setup lang="ts">
definePageMeta({ layout: false })

onMounted(() => {
  navigateTo('/show', { replace: true })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
  </div>
</template>
