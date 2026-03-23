<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t } = useI18n()

useHead({ title: computed(() => `${t('show.faq.title')} - UNMI.IO`) })

const faqs = ref<any[]>([])
const loading = ref(true)
const openIndex = ref<number | null>(null)

async function fetchFaqs() {
  try {
    const res = await $fetch<any>('/api/show/faqs')
    faqs.value = res.data || []
  } catch { /* ignore */ }
  loading.value = false
}

function toggle(i: number) {
  openIndex.value = openIndex.value === i ? null : i
}

onMounted(fetchFaqs)

// Default FAQs if none in DB
const defaultFaqs = computed(() => [
  { question: t('show.faq.q1'), answer: t('show.faq.a1') },
  { question: t('show.faq.q2'), answer: t('show.faq.a2') },
  { question: t('show.faq.q3'), answer: t('show.faq.a3') },
  { question: t('show.faq.q4'), answer: t('show.faq.a4') },
  { question: t('show.faq.q5'), answer: t('show.faq.a5') },
  { question: t('show.faq.q6'), answer: t('show.faq.a6') },
])

const displayFaqs = computed(() => faqs.value.length > 0 ? faqs.value : defaultFaqs.value)
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-gradient-to-br from-gray-50 to-blue-50 py-16">
      <div class="max-w-3xl mx-auto px-4 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{{ t('show.faq.title') }}</h1>
        <p class="text-gray-500">{{ t('show.faq.subtitle') }}</p>
      </div>
    </div>

    <!-- FAQ List -->
    <div class="max-w-3xl mx-auto px-4 py-12">
      <div class="space-y-3">
        <div
          v-for="(faq, i) in displayFaqs"
          :key="i"
          class="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm"
        >
          <button
            class="w-full flex items-center justify-between px-6 py-5 text-left"
            @click="toggle(i)"
          >
            <span class="text-base font-medium text-gray-900 pr-4">{{ faq.question }}</span>
            <Icon
              name="material-symbols:expand-more"
              class="h-5 w-5 text-gray-400 shrink-0 transition-transform duration-200"
              :class="{ 'rotate-180': openIndex === i }"
            />
          </button>
          <Transition name="faq">
            <div v-if="openIndex === i" class="px-6 pb-5">
              <p class="text-sm text-gray-600 leading-relaxed">{{ faq.answer }}</p>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Contact CTA -->
      <div class="mt-12 text-center rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ t('show.faq.notFound') }}</h3>
        <p class="text-sm text-gray-500 mb-4">{{ t('show.faq.notFoundDesc') }}</p>
        <NuxtLink
          to="/show/inquiry"
          class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Icon name="material-symbols:mail-outline" class="h-4 w-4" />
          {{ t('show.contactUs') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-enter-active, .faq-leave-active { transition: all 0.2s ease; overflow: hidden; }
.faq-enter-from, .faq-leave-to { opacity: 0; max-height: 0; }
.faq-enter-to, .faq-leave-from { opacity: 1; max-height: 200px; }
</style>
