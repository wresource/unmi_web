<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  domainName?: string
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()

const form = reactive({
  name: '',
  email: '',
  phone: '',
  wechat: '',
  company: '',
  domain_name: props.domainName || '',
  budget: '',
  message: '',
})

const loading = ref(false)
const error = ref('')

watch(() => props.domainName, (v) => {
  if (v) form.domain_name = v
})

watch(() => props.visible, (v) => {
  if (v) {
    error.value = ''
    if (props.domainName) form.domain_name = props.domainName
  }
})

async function submit() {
  if (!form.name || !form.email || !form.domain_name) {
    error.value = t('show.inquiry.requiredFieldsError')
    return
  }
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/show/inquiry', {
      method: 'POST',
      body: { ...form },
    })
    emit('success')
    // Reset form
    Object.assign(form, {
      name: '',
      email: '',
      phone: '',
      wechat: '',
      company: '',
      domain_name: props.domainName || '',
      budget: '',
      message: '',
    })
  } catch (e: any) {
    error.value = e?.data?.message || t('show.inquiry.submitError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
        @click.self="emit('close')"
      >
        <div class="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 class="text-lg font-bold text-gray-900">{{ t('show.inquiry.title') }}</h2>
            <button
              class="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              @click="emit('close')"
            >
              <Icon name="material-symbols:close" class="h-5 w-5" />
            </button>
          </div>

          <!-- Form -->
          <form class="p-6 space-y-4" @submit.prevent="submit">
            <div v-if="error" class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {{ error }}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.interestedDomain') }} <span class="text-red-500">*</span></label>
              <input
                v-model="form.domain_name"
                type="text"
                class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                :placeholder="t('show.inquiry.domainExample')"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.name') }} <span class="text-red-500">*</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.email') }} <span class="text-red-500">*</span></label>
                <input
                  v-model="form.email"
                  type="email"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.phone') }}</label>
                <input
                  v-model="form.phone"
                  type="text"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.wechatLabel') }}</label>
                <input
                  v-model="form.wechat"
                  type="text"
                  class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.company') }}</label>
              <input
                v-model="form.company"
                type="text"
                class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.budgetLabel') }}</label>
              <input
                v-model="form.budget"
                type="text"
                class="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm input-focus"
                :placeholder="t('show.inquiry.budgetPlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('show.inquiry.message') }}</label>
              <textarea
                v-model="form.message"
                rows="3"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm input-focus resize-none"
                :placeholder="t('show.inquiry.messagePlaceholder')"
              />
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full h-11 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ loading ? t('show.inquiry.submitting') : t('show.inquiry.submitBtn') }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
