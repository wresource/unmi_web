<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const appStore = useAppStore()
appStore.setPageTitle(t('nav.showcaseSettings'))

const activeTab = ref('settings')
const tabs = computed(() => [
  { key: 'settings', label: t('showcase.displaySettings'), icon: 'material-symbols:settings' },
  { key: 'domains', label: t('showcase.domainMgmt'), icon: 'material-symbols:domain' },
  { key: 'categories', label: t('showcase.categoryMgmt'), icon: 'material-symbols:category' },
  { key: 'inquiries', label: t('showcase.inquiryMgmt'), icon: 'material-symbols:mail' },
])

// ============ TAB 1: Settings ============
const showcaseSettings = reactive({
  is_public: false,
  contact_email: '',
  contact_wechat: '',
})
const settingsLoading = ref(false)
const settingsSaved = ref(false)

async function loadSettings() {
  try {
    const res = await $fetch<any>('/api/showcase/settings')
    if (res?.data) {
      showcaseSettings.is_public = !!res.data.is_public
      showcaseSettings.contact_email = res.data.contact_email || ''
      showcaseSettings.contact_wechat = res.data.contact_wechat || ''
    }
  } catch {}
}

async function saveSettings() {
  settingsLoading.value = true
  try {
    await $fetch('/api/showcase/settings', {
      method: 'PUT',
      body: { ...showcaseSettings },
    })
    settingsSaved.value = true
    setTimeout(() => { settingsSaved.value = false }, 2000)
  } catch {} finally {
    settingsLoading.value = false
  }
}

// ============ TAB 2: Domains ============
const domainsSearch = ref('')
const domainsPage = ref(1)
const domainsData = ref<any[]>([])
const domainsTotal = ref(0)
const domainsLoading = ref(false)
const selectedDomains = ref<Set<number>>(new Set())

async function loadDomains() {
  domainsLoading.value = true
  try {
    const res = await $fetch<any>('/api/showcase/domains', {
      query: { search: domainsSearch.value, page: domainsPage.value, pageSize: 20 },
    })
    domainsData.value = res?.data || []
    domainsTotal.value = res?.total || 0
  } catch {} finally {
    domainsLoading.value = false
  }
}

async function toggleDomainPublic(domain: any) {
  try {
    await $fetch(`/api/showcase/domains/${domain.id}`, {
      method: 'PUT',
      body: { is_public: domain.is_public ? 0 : 1 },
    })
    domain.is_public = domain.is_public ? 0 : 1
  } catch {}
}

async function toggleDomainFeatured(domain: any) {
  try {
    await $fetch(`/api/showcase/domains/${domain.id}`, {
      method: 'PUT',
      body: { is_featured: domain.is_featured ? 0 : 1 },
    })
    domain.is_featured = domain.is_featured ? 0 : 1
  } catch {}
}

async function updateDomainField(domain: any, field: string, value: any) {
  try {
    await $fetch(`/api/showcase/domains/${domain.id}`, {
      method: 'PUT',
      body: { [field]: value },
    })
  } catch {}
}

function toggleSelectDomain(id: number) {
  if (selectedDomains.value.has(id)) {
    selectedDomains.value.delete(id)
  } else {
    selectedDomains.value.add(id)
  }
}

function toggleSelectAll() {
  if (selectedDomains.value.size === domainsData.value.length) {
    selectedDomains.value.clear()
  } else {
    domainsData.value.forEach(d => selectedDomains.value.add(d.id))
  }
}

async function bulkSetPublic(isPublic: boolean) {
  const ids = Array.from(selectedDomains.value)
  if (!ids.length) return
  try {
    await $fetch('/api/showcase/domains/bulk', {
      method: 'PUT',
      body: { ids, is_public: isPublic ? 1 : 0 },
    })
    await loadDomains()
    selectedDomains.value.clear()
  } catch {}
}

// ============ TAB 3: Categories ============
const categoriesData = ref<any[]>([])
const categoriesLoading = ref(false)
const editingCategory = ref<any>(null)
const showCategoryForm = ref(false)
const categoryForm = reactive({
  id: 0,
  name: '',
  slug: '',
  description: '',
  sort_order: 0,
})

async function loadCategories() {
  categoriesLoading.value = true
  try {
    const res = await $fetch<any>('/api/showcase/categories')
    categoriesData.value = res?.data || []
  } catch {} finally {
    categoriesLoading.value = false
  }
}

function openCategoryForm(cat?: any) {
  if (cat) {
    Object.assign(categoryForm, { id: cat.id, name: cat.name, slug: cat.slug || '', description: cat.description || '', sort_order: cat.sort_order || 0 })
  } else {
    Object.assign(categoryForm, { id: 0, name: '', slug: '', description: '', sort_order: 0 })
  }
  showCategoryForm.value = true
}

async function saveCategory() {
  try {
    if (categoryForm.id) {
      await $fetch(`/api/showcase/categories/${categoryForm.id}`, {
        method: 'PUT',
        body: { ...categoryForm },
      })
    } else {
      await $fetch('/api/showcase/categories', {
        method: 'POST',
        body: { ...categoryForm },
      })
    }
    showCategoryForm.value = false
    await loadCategories()
  } catch {}
}

async function deleteCategory(id: number) {
  if (!confirm(t('domains.deleteConfirm'))) return
  try {
    await $fetch(`/api/showcase/categories/${id}`, { method: 'DELETE' })
    await loadCategories()
  } catch {}
}

// ============ TAB 4: Inquiries ============
const inquiriesData = ref<any[]>([])
const inquiriesTotal = ref(0)
const inquiriesPage = ref(1)
const inquiriesLoading = ref(false)
const inquiryStatusFilter = ref('')

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('showcase.pending'),
  contacted: t('showcase.contacted'),
  closed: t('showcase.closed'),
  invalid: t('showcase.invalid'),
}))

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  contacted: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  invalid: 'bg-gray-100 text-gray-500',
}

async function loadInquiries() {
  inquiriesLoading.value = true
  try {
    const res = await $fetch<any>('/api/showcase/inquiries', {
      query: { page: inquiriesPage.value, pageSize: 20, status: inquiryStatusFilter.value },
    })
    inquiriesData.value = res?.data || []
    inquiriesTotal.value = res?.total || 0
  } catch {} finally {
    inquiriesLoading.value = false
  }
}

async function updateInquiryStatus(id: number, status: string) {
  try {
    await $fetch(`/api/showcase/inquiries/${id}`, {
      method: 'PUT',
      body: { status },
    })
    await loadInquiries()
  } catch {}
}

// Load data on tab change
watch(activeTab, (tab) => {
  if (tab === 'settings') loadSettings()
  else if (tab === 'domains') loadDomains()
  else if (tab === 'categories') loadCategories()
  else if (tab === 'inquiries') loadInquiries()
}, { immediate: true })

// Watch domain search/page
watch([domainsSearch, domainsPage], () => {
  if (activeTab.value === 'domains') loadDomains()
})

watch([inquiriesPage, inquiryStatusFilter], () => {
  if (activeTab.value === 'inquiries') loadInquiries()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Tabs -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="border-b border-gray-200">
        <nav class="flex overflow-x-auto px-4">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ]"
            @click="activeTab = tab.key"
          >
            <Icon :name="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- TAB 1: Settings -->
        <div v-if="activeTab === 'settings'" class="max-w-xl space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('showcase.displaySwitch') }}</h3>
            <label class="flex items-center gap-3 cursor-pointer">
              <button
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  showcaseSettings.is_public ? 'bg-blue-600' : 'bg-gray-200',
                ]"
                @click="showcaseSettings.is_public = !showcaseSettings.is_public"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    showcaseSettings.is_public ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
              <span class="text-sm text-gray-700">
                {{ showcaseSettings.is_public ? t('showcase.displayOn') : t('showcase.displayOff') }}
              </span>
            </label>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('showcase.contactInfo') }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.contactEmail') }}</label>
                <input
                  v-model="showcaseSettings.contact_email"
                  type="email"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.wechat') }}</label>
                <input
                  v-model="showcaseSettings.contact_wechat"
                  type="text"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                />
              </div>
            </div>
          </div>

          <button
            :disabled="settingsLoading"
            class="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            @click="saveSettings"
          >
            {{ settingsSaved ? t('common.saved') : settingsLoading ? t('common.saving') : t('common.save') }}
          </button>
        </div>

        <!-- TAB 2: Domains -->
        <div v-else-if="activeTab === 'domains'">
          <!-- Toolbar -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div class="relative flex-1 w-full sm:max-w-xs">
              <Icon name="material-symbols:search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="domainsSearch"
                type="text"
                :placeholder="t('domains.searchPlaceholder')"
                class="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm input-focus"
              />
            </div>
            <div v-if="selectedDomains.size > 0" class="flex items-center gap-2">
              <span class="text-sm text-gray-500">{{ t('common.selected', { n: selectedDomains.size }) }}</span>
              <button
                class="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                @click="bulkSetPublic(true)"
              >
                {{ t('showcase.batchPublic') }}
              </button>
              <button
                class="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
                @click="bulkSetPublic(false)"
              >
                {{ t('showcase.batchHide') }}
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto -mx-6 px-6">
            <div v-if="domainsLoading" class="flex justify-center py-12">
              <div class="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="py-2 px-2 text-left">
                    <input
                      type="checkbox"
                      :checked="selectedDomains.size === domainsData.length && domainsData.length > 0"
                      class="rounded"
                      @change="toggleSelectAll"
                    />
                  </th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('domains.domainName') }}</th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('showcase.public') }}</th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('showcase.featured') }}</th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('showcase.price') }}</th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('showcase.priceType') }}</th>
                  <th class="py-2 px-2 text-left font-medium text-gray-500">{{ t('showcase.description') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="domain in domainsData"
                  :key="domain.id"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="py-2.5 px-2">
                    <input
                      type="checkbox"
                      :checked="selectedDomains.has(domain.id)"
                      class="rounded"
                      @change="toggleSelectDomain(domain.id)"
                    />
                  </td>
                  <td class="py-2.5 px-2 font-medium text-gray-900 whitespace-nowrap">
                    {{ domain.domain_name }}
                  </td>
                  <td class="py-2.5 px-2">
                    <button
                      :class="[
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        domain.is_public ? 'bg-blue-600' : 'bg-gray-200',
                      ]"
                      @click="toggleDomainPublic(domain)"
                    >
                      <span
                        :class="[
                          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                          domain.is_public ? 'translate-x-4' : 'translate-x-0',
                        ]"
                      />
                    </button>
                  </td>
                  <td class="py-2.5 px-2">
                    <button
                      :class="[
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        domain.is_featured ? 'bg-amber-500' : 'bg-gray-200',
                      ]"
                      @click="toggleDomainFeatured(domain)"
                    >
                      <span
                        :class="[
                          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                          domain.is_featured ? 'translate-x-4' : 'translate-x-0',
                        ]"
                      />
                    </button>
                  </td>
                  <td class="py-2.5 px-2">
                    <input
                      :value="domain.show_price"
                      type="number"
                      class="w-24 h-8 px-2 rounded border border-gray-200 text-xs input-focus"
                      @change="(e: Event) => updateDomainField(domain, 'show_price', parseFloat((e.target as HTMLInputElement).value) || 0)"
                    />
                  </td>
                  <td class="py-2.5 px-2">
                    <select
                      :value="domain.price_type || 'inquiry'"
                      class="h-8 px-2 rounded border border-gray-200 text-xs input-focus bg-white"
                      @change="(e: Event) => updateDomainField(domain, 'price_type', (e.target as HTMLSelectElement).value)"
                    >
                      <option value="fixed">{{ t('showcase.fixedPrice') }}</option>
                      <option value="inquiry">{{ t('showcase.inquiry') }}</option>
                    </select>
                  </td>
                  <td class="py-2.5 px-2">
                    <input
                      :value="domain.show_description || ''"
                      type="text"
                      class="w-40 h-8 px-2 rounded border border-gray-200 text-xs input-focus"
                      :placeholder="t('showcase.descPlaceholder')"
                      @change="(e: Event) => updateDomainField(domain, 'show_description', (e.target as HTMLInputElement).value)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Domain pagination -->
          <div v-if="domainsTotal > 20" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span class="text-sm text-gray-500">{{ t('common.total', { n: domainsTotal }) }}</span>
            <div class="flex gap-1">
              <button
                :disabled="domainsPage <= 1"
                class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                @click="domainsPage--"
              >
                {{ t('common.prev') }}
              </button>
              <button
                :disabled="domainsPage * 20 >= domainsTotal"
                class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                @click="domainsPage++"
              >
                {{ t('common.next') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 3: Categories -->
        <div v-else-if="activeTab === 'categories'">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('showcase.categoryList') }}</h3>
            <button
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              @click="openCategoryForm()"
            >
              {{ t('showcase.addCategory') }}
            </button>
          </div>

          <div v-if="categoriesLoading" class="flex justify-center py-12">
            <div class="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>

          <div v-else-if="categoriesData.length === 0" class="text-center py-12 text-gray-500">
            {{ t('showcase.noCategories') }}
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="cat in categoriesData"
              :key="cat.id"
              class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <div class="font-medium text-gray-900">{{ cat.name }}</div>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ cat.slug || '--' }} &middot; {{ t('showcase.sortOrder') }}: {{ cat.sort_order || 0 }}
                  <span v-if="cat.description"> &middot; {{ cat.description }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-3 py-1.5 rounded text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                  @click="openCategoryForm(cat)"
                >
                  {{ t('common.edit') }}
                </button>
                <button
                  class="px-3 py-1.5 rounded text-xs text-red-600 hover:bg-red-50 transition-colors"
                  @click="deleteCategory(cat.id)"
                >
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Category Form Modal -->
          <Teleport to="body">
            <Transition name="modal">
              <div
                v-if="showCategoryForm"
                class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
                @click.self="showCategoryForm = false"
              >
                <div class="modal-content bg-white rounded-xl shadow-2xl w-full max-w-md">
                  <div class="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 class="font-semibold text-gray-900">
                      {{ categoryForm.id ? t('showcase.editCategory') : t('showcase.addCategory') }}
                    </h3>
                    <button
                      class="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      @click="showCategoryForm = false"
                    >
                      <Icon name="material-symbols:close" class="h-5 w-5" />
                    </button>
                  </div>
                  <form class="p-5 space-y-4" @submit.prevent="saveCategory">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.categoryName') }}</label>
                      <input
                        v-model="categoryForm.name"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                        required
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.categorySlug') }}</label>
                      <input
                        v-model="categoryForm.slug"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                        :placeholder="t('showcase.slugPlaceholder')"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.categoryDesc') }}</label>
                      <textarea
                        v-model="categoryForm.description"
                        rows="2"
                        class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm input-focus resize-none"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('showcase.sortOrder') }}</label>
                      <input
                        v-model.number="categoryForm.sort_order"
                        type="number"
                        class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                      />
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        class="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        @click="showCategoryForm = false"
                      >
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        type="submit"
                        class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        {{ t('common.save') }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>

        <!-- TAB 4: Inquiries -->
        <div v-else-if="activeTab === 'inquiries'">
          <div class="flex items-center gap-3 mb-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('showcase.inquiryList') }}</h3>
            <select
              v-model="inquiryStatusFilter"
              class="h-9 px-3 rounded-lg border border-gray-200 text-sm input-focus bg-white"
            >
              <option value="">{{ t('showcase.allStatus') }}</option>
              <option value="pending">{{ t('showcase.pending') }}</option>
              <option value="contacted">{{ t('showcase.contacted') }}</option>
              <option value="closed">{{ t('showcase.closed') }}</option>
              <option value="invalid">{{ t('showcase.invalid') }}</option>
            </select>
          </div>

          <div v-if="inquiriesLoading" class="flex justify-center py-12">
            <div class="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>

          <div v-else-if="inquiriesData.length === 0" class="text-center py-12 text-gray-500">
            {{ t('showcase.noInquiries') }}
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="inq in inquiriesData"
              :key="inq.id"
              class="bg-gray-50 rounded-lg p-4"
            >
              <div class="flex items-start justify-between mb-2">
                <div>
                  <span class="font-semibold text-gray-900">{{ inq.domain_name }}</span>
                  <span
                    :class="['ml-2 px-2 py-0.5 rounded-full text-xs font-medium', statusColors[inq.status] || 'bg-gray-100 text-gray-500']"
                  >
                    {{ statusLabels[inq.status] || inq.status }}
                  </span>
                </div>
                <span class="text-xs text-gray-400">{{ inq.created_at }}</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
                <div><span class="text-gray-400">{{ t('show.inquiry.name') }}:</span> {{ inq.name }}</div>
                <div><span class="text-gray-400">{{ t('show.inquiry.email') }}:</span> {{ inq.email }}</div>
                <div v-if="inq.phone"><span class="text-gray-400">{{ t('show.inquiry.phone') }}:</span> {{ inq.phone }}</div>
                <div v-if="inq.budget"><span class="text-gray-400">{{ t('showcase.budget') }}:</span> {{ inq.budget }}</div>
              </div>
              <p v-if="inq.message" class="text-sm text-gray-500 mb-3">{{ inq.message }}</p>
              <div class="flex items-center gap-2">
                <button
                  v-for="s in ['pending', 'contacted', 'closed', 'invalid']"
                  :key="s"
                  :class="[
                    'px-2.5 py-1 rounded text-xs transition-colors',
                    inq.status === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100',
                  ]"
                  @click="updateInquiryStatus(inq.id, s)"
                >
                  {{ statusLabels[s] }}
                </button>
              </div>
            </div>
          </div>

          <!-- Inquiry pagination -->
          <div v-if="inquiriesTotal > 20" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span class="text-sm text-gray-500">{{ t('common.total', { n: inquiriesTotal }) }}</span>
            <div class="flex gap-1">
              <button
                :disabled="inquiriesPage <= 1"
                class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                @click="inquiriesPage--"
              >
                {{ t('common.prev') }}
              </button>
              <button
                :disabled="inquiriesPage * 20 >= inquiriesTotal"
                class="h-8 px-3 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                @click="inquiriesPage++"
              >
                {{ t('common.next') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
