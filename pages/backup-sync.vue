<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()

// Backup
const backupLoading = ref(false)
const lastBackupTime = ref<string | null>(null)

// Restore
const restoreFile = ref<File | null>(null)
const restoreLoading = ref(false)
const restoreConfirmOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Logs
const logs = ref<any[]>([])
const logsLoading = ref(true)

async function fetchLogs() {
  logsLoading.value = true
  try {
    const data = await $fetch<any>('/api/backup/logs')
    logs.value = data.logs ?? data ?? []
    lastBackupTime.value = data.last_backup_time ?? (logs.value.length > 0 ? logs.value[0].created_at : null)
  } catch (e: any) {
    toast.error(e?.data?.message || t('backup.fetchLogsFailed'))
  } finally {
    logsLoading.value = false
  }
}

async function createBackup() {
  backupLoading.value = true
  try {
    const blob = await $fetch<Blob>('/api/backup/export', {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `domain-backup_${new Date().toISOString().slice(0, 10)}.enc`
    a.click()
    URL.revokeObjectURL(url)
    lastBackupTime.value = new Date().toLocaleString('zh-CN')
    toast.success(t('backup.backupDownloaded'))
    fetchLogs()
  } catch (e: any) {
    toast.error(e?.data?.message || t('backup.backupFailed'))
  } finally {
    backupLoading.value = false
  }
}

function handleRestoreFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    restoreFile.value = target.files[0]
  }
}

function openRestoreConfirm() {
  if (!restoreFile.value) {
    toast.warning(t('backup.selectFileFirst'))
    return
  }
  restoreConfirmOpen.value = true
}

async function doRestore() {
  if (!restoreFile.value) return
  restoreConfirmOpen.value = false
  restoreLoading.value = true

  try {
    const formData = new FormData()
    formData.append('file', restoreFile.value)

    await $fetch('/api/backup/restore', {
      method: 'POST',
      body: formData,
    })

    toast.success(t('backup.restoreSuccess'))
    restoreFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    fetchLogs()
  } catch (e: any) {
    toast.error(e?.data?.message || t('backup.restoreFailed'))
  } finally {
    restoreLoading.value = false
  }
}

const logTypeMap = computed<Record<string, { label: string; class: string }>>(() => ({
  backup: { label: t('backup.logTypeBackup'), class: 'bg-blue-100 text-blue-700' },
  restore: { label: t('backup.logTypeRestore'), class: 'bg-green-100 text-green-700' },
  sync: { label: t('backup.logTypeSync'), class: 'bg-purple-100 text-purple-700' },
  export: { label: t('backup.logTypeExport'), class: 'bg-cyan-100 text-cyan-700' },
  import: { label: t('backup.logTypeImport'), class: 'bg-amber-100 text-amber-700' },
}))

function getLogType(type: string) {
  return logTypeMap.value[type] || { label: type, class: 'bg-gray-100 text-gray-600' }
}

const logStatusMap = computed<Record<string, { label: string; class: string }>>(() => ({
  success: { label: t('backup.logStatusSuccess'), class: 'text-green-600' },
  failed: { label: t('backup.logStatusFailed'), class: 'text-red-600' },
  pending: { label: t('backup.logStatusPending'), class: 'text-amber-600' },
}))

function getLogStatus(status: string) {
  return logStatusMap.value[status] || { label: status, class: 'text-gray-600' }
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Local backup -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
        <div class="flex items-center gap-3 mb-5">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Icon name="material-symbols:backup" class="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-800">{{ t('backup.localBackup') }}</h3>
            <p class="text-xs text-gray-400">{{ t('backup.localBackupDesc') }}</p>
          </div>
        </div>

        <div class="mb-5 rounded-lg bg-gray-50 p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">{{ t('backup.lastBackup') }}</span>
            <span class="text-sm font-medium text-gray-700">
              {{ lastBackupTime || t('backup.noBackupRecord') }}
            </span>
          </div>
        </div>

        <button
          :disabled="backupLoading"
          class="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          @click="createBackup"
        >
          <div v-if="backupLoading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:download" class="h-4 w-4" />
          {{ backupLoading ? t('backup.backingUp') : t('backup.exportBackup') }}
        </button>
      </div>

      <!-- Restore -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
        <div class="flex items-center gap-3 mb-5">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <Icon name="material-symbols:restore" class="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-800">{{ t('backup.importRestore') }}</h3>
            <p class="text-xs text-gray-400">{{ t('backup.importRestoreDesc') }}</p>
          </div>
        </div>

        <div class="mb-5">
          <label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".enc,.bak,.json"
              class="hidden"
              @change="handleRestoreFileSelect"
            />
            <Icon name="material-symbols:upload-file" class="h-8 w-8 text-gray-300" />
            <div class="min-w-0 flex-1">
              <p v-if="restoreFile" class="text-sm font-medium text-gray-700 truncate">{{ restoreFile.name }}</p>
              <p v-else class="text-sm text-gray-500">{{ t('backup.selectFile') }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ t('backup.supportFormats') }}</p>
            </div>
          </label>
        </div>

        <button
          :disabled="restoreLoading || !restoreFile"
          class="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          @click="openRestoreConfirm"
        >
          <div v-if="restoreLoading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:restore" class="h-4 w-4" />
          {{ restoreLoading ? t('backup.restoring') : t('backup.restore') }}
        </button>
      </div>
    </div>

    <!-- Confirm modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="restoreConfirmOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" @click.stop>
            <div class="flex items-center gap-3 mb-4">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Icon name="material-symbols:warning" class="h-5 w-5 text-amber-600" />
              </div>
              <h3 class="text-lg font-semibold text-gray-800">{{ t('backup.confirmRestore') }}</h3>
            </div>
            <p class="mb-6 text-sm text-gray-600">
              {{ t('backup.restoreConfirm') }}
            </p>
            <div class="flex justify-end gap-3">
              <button
                class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                @click="restoreConfirmOpen = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                @click="doRestore"
              >
                {{ t('backup.confirmRestoreBtn') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Sync logs -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 class="text-base font-semibold text-gray-800">{{ t('backup.syncLogs') }}</h3>
        <button
          class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          @click="fetchLogs"
        >
          <Icon name="material-symbols:refresh" class="h-3.5 w-3.5" />
          {{ t('common.refresh') }}
        </button>
      </div>

      <div v-if="logsLoading" class="flex items-center justify-center py-12">
        <div class="h-6 w-6 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
      </div>

      <div v-else-if="logs.length === 0" class="py-12 text-center text-sm text-gray-400">
        <Icon name="material-symbols:description" class="mx-auto mb-2 h-10 w-10 text-gray-200" />
        <p>{{ t('backup.noLogs') }}</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50/50">
              <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('backup.logType') }}</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('backup.logDetails') }}</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('backup.logStatus') }}</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('backup.logTime') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in logs"
              :key="log.id"
              class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-5 py-3">
                <span :class="['inline-flex rounded-full px-2 py-0.5 text-xs font-medium', getLogType(log.type).class]">
                  {{ getLogType(log.type).label }}
                </span>
              </td>
              <td class="px-5 py-3 text-gray-700">{{ log.description }}</td>
              <td class="px-5 py-3">
                <span :class="['text-sm font-medium', getLogStatus(log.status).class]">
                  {{ getLogStatus(log.status).label }}
                </span>
              </td>
              <td class="px-5 py-3 text-gray-500 whitespace-nowrap">{{ log.created_at }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
