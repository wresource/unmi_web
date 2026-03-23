<script setup lang="ts">
import * as XLSX from 'xlsx'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const toast = useToast()

// Tab
const activeTab = ref<'import' | 'export'>('import')

// ---- IMPORT ----
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const importFile = ref<File | null>(null)
const parsedData = ref<any[]>([])
const parsedHeaders = ref<string[]>([])
const importing = ref(false)
const importResult = ref<any>(null)

const systemFields = computed(() => [
  { key: '', label: t('importExport.skip') },
  { key: 'domain', label: t('domains.domainName') },
  { key: 'registrar', label: t('domains.registrar') },
  { key: 'registration_date', label: t('domains.form.regDate') },
  { key: 'expiration_date', label: t('domains.expiryDate') },
  { key: 'cost', label: t('domains.form.costInfo') },
  { key: 'auto_renew', label: t('domains.form.autoRenew') },
  { key: 'dns_provider', label: t('domains.form.dnsProvider') },
  { key: 'category', label: t('showcase.categoryFilter') || 'Category' },
  { key: 'notes', label: t('domains.notes') },
])

const fieldMapping = ref<Record<string, string>>({})

const validationErrors = ref<Array<{ row: number; message: string }>>([])

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function handleDragLeave() {
  dragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    processFile(files[0])
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    processFile(target.files[0])
  }
}

function processFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'csv', 'xls'].includes(ext || '')) {
    toast.error(t('importExport.unsupportedFormat'))
    return
  }

  importFile.value = file
  importResult.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      if (jsonData.length < 2) {
        toast.error(t('importExport.noDataInFile'))
        return
      }

      parsedHeaders.value = jsonData[0].map(String)
      parsedData.value = jsonData.slice(1).filter((row) => row.some((cell) => cell != null && cell !== ''))

      // Auto-map fields by name similarity
      const mapping: Record<string, string> = {}
      const nameMap: Record<string, string> = {
        '域名': 'domain', 'domain': 'domain',
        '注册商': 'registrar', 'registrar': 'registrar',
        '注册日期': 'registration_date', 'registration_date': 'registration_date',
        '到期日期': 'expiration_date', 'expiration_date': 'expiration_date',
        '费用': 'cost', 'cost': 'cost', 'price': 'cost',
        '自动续费': 'auto_renew', 'auto_renew': 'auto_renew',
        'DNS服务商': 'dns_provider', 'dns_provider': 'dns_provider',
        '分类': 'category', 'category': 'category',
        '备注': 'notes', 'notes': 'notes',
      }
      parsedHeaders.value.forEach((header) => {
        const lower = header.toLowerCase().trim()
        mapping[header] = nameMap[lower] || nameMap[header] || ''
      })
      fieldMapping.value = mapping

      validateData()
      toast.success(t('importExport.parsedRecords', { n: parsedData.value.length }))
    } catch {
      toast.error(t('importExport.parseError'))
    }
  }
  reader.readAsArrayBuffer(file)
}

function validateData() {
  const errors: Array<{ row: number; message: string }> = []
  const domainIdx = parsedHeaders.value.findIndex((h) => fieldMapping.value[h] === 'domain')

  parsedData.value.forEach((row, i) => {
    if (domainIdx >= 0 && (!row[domainIdx] || String(row[domainIdx]).trim() === '')) {
      errors.push({ row: i + 2, message: t('importExport.domainEmpty') })
    }
  })

  if (domainIdx < 0 && parsedHeaders.value.length > 0) {
    errors.push({ row: 0, message: t('importExport.domainFieldRequired') })
  }

  validationErrors.value = errors
}

watch(fieldMapping, () => {
  validateData()
}, { deep: true })

const previewRows = computed(() => parsedData.value.slice(0, 10))

async function doImport() {
  if (validationErrors.value.some((e) => e.row === 0)) {
    toast.error(t('importExport.completeMapping'))
    return
  }

  importing.value = true
  try {
    const mappedData = parsedData.value.map((row) => {
      const obj: Record<string, any> = {}
      parsedHeaders.value.forEach((header, idx) => {
        const field = fieldMapping.value[header]
        if (field) {
          obj[field] = row[idx]
        }
      })
      return obj
    })

    importResult.value = await $fetch('/api/domains/import', {
      method: 'POST',
      body: { domains: mappedData },
    })
    toast.success(t('importExport.importComplete', { n: importResult.value.success ?? 0 }))
  } catch (e: any) {
    toast.error(e?.data?.message || t('importExport.importFailed'))
  } finally {
    importing.value = false
  }
}

function downloadTemplate() {
  const headers = ['域名', '注册商', '注册日期', '到期日期', '费用', '自动续费', 'DNS服务商', '分类', '备注']
  const sampleRow = ['example.com', 'Namesilo', '2024-01-01', '2025-01-01', '68', '是', 'Cloudflare', '个人', '示例数据']
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '域名数据')
  XLSX.writeFile(wb, '域名导入模板.xlsx')
}

function resetImport() {
  importFile.value = null
  parsedData.value = []
  parsedHeaders.value = []
  fieldMapping.value = {}
  validationErrors.value = []
  importResult.value = null
  if (fileInput.value) fileInput.value.value = ''
}

// ---- EXPORT ----
const exportScope = ref('all')
const exportFormat = ref('xlsx')
const exporting = ref(false)

const exportFields = computed(() => [
  { key: 'domain', label: t('domains.domainName'), checked: true },
  { key: 'registrar', label: t('domains.registrar'), checked: true },
  { key: 'registration_date', label: t('domains.form.regDate'), checked: true },
  { key: 'expiration_date', label: t('domains.expiryDate'), checked: true },
  { key: 'cost', label: t('domains.form.costInfo'), checked: true },
  { key: 'auto_renew', label: t('domains.form.autoRenew'), checked: true },
  { key: 'dns_provider', label: t('domains.form.dnsProvider'), checked: true },
  { key: 'category', label: t('showcase.categoryFilter') || 'Category', checked: true },
  { key: 'notes', label: t('domains.notes'), checked: false },
])

const exportFieldsState = ref(exportFields.value.map((f) => ({ ...f })))

watch(exportFields, (newVal) => {
  exportFieldsState.value = newVal.map((f, i) => ({
    ...f,
    checked: exportFieldsState.value[i]?.checked ?? f.checked,
  }))
}, { immediate: true })

function toggleAllFields(checked: boolean) {
  exportFieldsState.value.forEach((f) => { f.checked = checked })
}

async function doExport() {
  const selectedFields = exportFieldsState.value.filter((f) => f.checked).map((f) => f.key)
  if (selectedFields.length === 0) {
    toast.warning(t('importExport.selectOneField'))
    return
  }

  exporting.value = true
  try {
    const data = await $fetch<any[]>('/api/domains/export', {
      params: {
        scope: exportScope.value,
        fields: selectedFields.join(','),
      },
    })

    // Build worksheet
    const headers = exportFieldsState.value.filter((f) => f.checked).map((f) => f.label)
    const rows = data.map((item: any) =>
      selectedFields.map((key) => item[key] ?? '')
    )
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '域名数据')

    const filename = `域名导出_${new Date().toISOString().slice(0, 10)}`
    if (exportFormat.value === 'csv') {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' })
    } else {
      XLSX.writeFile(wb, `${filename}.xlsx`)
    }

    toast.success(t('importExport.exportSuccess'))
  } catch (e: any) {
    toast.error(e?.data?.message || t('importExport.exportFailed'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Tab switcher -->
    <div class="flex rounded-xl bg-white shadow-sm border border-gray-100 p-1">
      <button
        :class="[
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
          activeTab === 'import'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
        ]"
        @click="activeTab = 'import'"
      >
        <Icon name="material-symbols:upload" class="mr-1.5 h-4 w-4 inline" />
        {{ t('importExport.importTab') }}
      </button>
      <button
        :class="[
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
          activeTab === 'export'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
        ]"
        @click="activeTab = 'export'"
      >
        <Icon name="material-symbols:download" class="mr-1.5 h-4 w-4 inline" />
        {{ t('importExport.exportTab') }}
      </button>
    </div>

    <!-- IMPORT SECTION -->
    <div v-if="activeTab === 'import'" class="space-y-6">
      <!-- Upload area -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('importExport.uploadFile') }}</h3>
          <button
            class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            @click="downloadTemplate"
          >
            <Icon name="material-symbols:download" class="h-3.5 w-3.5" />
            {{ t('importExport.downloadTemplate') }}
          </button>
        </div>

        <div
          :class="[
            'relative rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
          ]"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="fileInput?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.csv,.xls"
            class="hidden"
            @change="handleFileSelect"
          />
          <Icon name="material-symbols:cloud-upload" class="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p class="text-sm text-gray-600">
            {{ t('importExport.dragDrop') }}<span class="text-blue-600 font-medium">{{ t('importExport.dragDropClick') }}</span>
          </p>
          <p class="mt-1 text-xs text-gray-400">{{ t('importExport.supportFormat') }}</p>
          <p v-if="importFile" class="mt-3 text-sm font-medium text-blue-600">
            {{ importFile.name }} ({{ t('importExport.fileRecords', { n: parsedData.length }) }})
          </p>
        </div>
      </div>

      <!-- Field mapping -->
      <div v-if="parsedHeaders.length > 0" class="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
        <h3 class="mb-4 text-base font-semibold text-gray-800">{{ t('importExport.fieldMapping') }}</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="header in parsedHeaders" :key="header" class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700" :title="header">
              {{ header }}
            </span>
            <Icon name="material-symbols:arrow-forward" class="h-4 w-4 shrink-0 text-gray-400" />
            <select
              v-model="fieldMapping[header]"
              class="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option v-for="sf in systemFields" :key="sf.key" :value="sf.key">{{ sf.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Validation errors -->
      <div v-if="validationErrors.length > 0" class="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="material-symbols:warning" class="h-5 w-5 text-amber-500" />
          <h4 class="text-sm font-semibold text-amber-800">{{ t('importExport.validationHint') }} ({{ validationErrors.length }})</h4>
        </div>
        <ul class="space-y-1 text-sm text-amber-700">
          <li v-for="(err, i) in validationErrors.slice(0, 5)" :key="i">
            <span v-if="err.row > 0">{{ t('importExport.rowError', { row: err.row }) }}</span>{{ err.message }}
          </li>
          <li v-if="validationErrors.length > 5" class="text-amber-500">{{ t('importExport.moreHints', { n: validationErrors.length - 5 }) }}</li>
        </ul>
      </div>

      <!-- Preview table -->
      <div v-if="previewRows.length > 0" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('importExport.preview') }} ({{ t('importExport.previewCount', { n: previewRows.length }) }})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/50">
                <th class="px-4 py-2.5 text-left font-medium text-gray-500">#</th>
                <th v-for="header in parsedHeaders" :key="header" class="px-4 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">
                  {{ header }}
                  <span v-if="fieldMapping[header]" class="ml-1 text-xs text-blue-500">({{ fieldMapping[header] }})</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in previewRows"
                :key="idx"
                class="border-b border-gray-50 hover:bg-gray-50/50"
              >
                <td class="px-4 py-2 text-gray-400">{{ idx + 1 }}</td>
                <td v-for="(cell, cIdx) in parsedHeaders.length" :key="cIdx" class="px-4 py-2 text-gray-700 whitespace-nowrap">
                  {{ row[cIdx] ?? '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Import actions -->
      <div v-if="parsedData.length > 0" class="flex items-center gap-3">
        <button
          :disabled="importing || validationErrors.some((e) => e.row === 0)"
          class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          @click="doImport"
        >
          <div v-if="importing" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:upload" class="h-4 w-4" />
          {{ importing ? t('importExport.importing') : t('importExport.importCount', { n: parsedData.length }) }}
        </button>
        <button
          class="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          @click="resetImport"
        >
          {{ t('common.reset') }}
        </button>
      </div>

      <!-- Import result -->
      <div v-if="importResult" class="rounded-xl bg-green-50 border border-green-200 p-5">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="material-symbols:check-circle" class="h-5 w-5 text-green-600" />
          <h4 class="text-sm font-semibold text-green-800">{{ t('importExport.importResult') }}</h4>
        </div>
        <div class="grid gap-2 text-sm text-green-700 sm:grid-cols-3">
          <p>{{ t('importExport.successCount', { n: importResult.success ?? 0 }) }}</p>
          <p>{{ t('importExport.skippedCount', { n: importResult.skipped ?? 0 }) }}</p>
          <p>{{ t('importExport.failedCount', { n: importResult.failed ?? 0 }) }}</p>
        </div>
      </div>
    </div>

    <!-- EXPORT SECTION -->
    <div v-if="activeTab === 'export'" class="space-y-6">
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
        <h3 class="mb-5 text-base font-semibold text-gray-800">{{ t('importExport.exportSettings') }}</h3>

        <!-- Scope -->
        <div class="mb-5">
          <label class="mb-2 block text-sm font-medium text-gray-700">{{ t('importExport.exportScope') }}</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="exportScope" type="radio" value="all" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">{{ t('importExport.exportAll') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="exportScope" type="radio" value="filtered" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">{{ t('importExport.exportFiltered') }}</span>
            </label>
          </div>
        </div>

        <!-- Format -->
        <div class="mb-5">
          <label class="mb-2 block text-sm font-medium text-gray-700">{{ t('importExport.exportFormat') }}</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="exportFormat" type="radio" value="xlsx" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">.xlsx (Excel)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="exportFormat" type="radio" value="csv" class="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">.csv</span>
            </label>
          </div>
        </div>

        <!-- Fields -->
        <div class="mb-5">
          <div class="mb-2 flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700">{{ t('importExport.exportFields') }}</label>
            <div class="flex gap-2">
              <button class="text-xs text-blue-600 hover:text-blue-700" @click="toggleAllFields(true)">{{ t('importExport.selectAll') }}</button>
              <span class="text-gray-300">|</span>
              <button class="text-xs text-blue-600 hover:text-blue-700" @click="toggleAllFields(false)">{{ t('importExport.deselectAll') }}</button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <label
              v-for="field in exportFieldsState"
              :key="field.key"
              class="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input v-model="field.checked" type="checkbox" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
              <span class="text-sm text-gray-700">{{ field.label }}</span>
            </label>
          </div>
        </div>

        <!-- Export button -->
        <button
          :disabled="exporting"
          class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          @click="doExport"
        >
          <div v-if="exporting" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:download" class="h-4 w-4" />
          {{ exporting ? t('importExport.exporting') : t('importExport.exportBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>
