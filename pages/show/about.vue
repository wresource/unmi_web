<script setup lang="ts">
definePageMeta({ layout: 'showcase' })

const { t } = useI18n()

useHead({ title: computed(() => `${t('show.about.title')} - UNMI.IO`) })
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900 py-20">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-white mb-4">{{ t('show.about.title') }}</h1>
        <p class="text-lg text-blue-200">{{ t('show.about.subtitle') }}</p>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <!-- About -->
      <section>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ t('show.about.intro') }}</h2>
        <div class="prose prose-gray max-w-none">
          <p class="text-gray-600 leading-relaxed">
            {{ t('show.about.introText1') }}
          </p>
          <p class="text-gray-600 leading-relaxed mt-4">
            {{ t('show.about.introText2') }}
          </p>
        </div>
      </section>

      <!-- Advantages -->
      <section>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">{{ t('show.about.advantages') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:verified" class="h-5 w-5 text-blue-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.premium') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.premiumDesc') }}</p>
          </div>
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:shield-outline" class="h-5 w-5 text-green-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.secure') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.secureDesc') }}</p>
          </div>
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:support-agent" class="h-5 w-5 text-purple-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.advisor') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.advisorDesc') }}</p>
          </div>
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:speed" class="h-5 w-5 text-amber-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.fast') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.fastDesc') }}</p>
          </div>
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:language" class="h-5 w-5 text-cyan-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.global') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.globalDesc') }}</p>
          </div>
          <div class="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div class="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center mb-4">
              <Icon name="material-symbols:diamond" class="h-5 w-5 text-rose-600" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ t('show.about.ai') }}</h3>
            <p class="text-sm text-gray-500">{{ t('show.about.aiDesc') }}</p>
          </div>
        </div>
      </section>

      <!-- Contact -->
      <section class="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ t('show.about.contact') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
              <Icon name="material-symbols:mail-outline" class="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">{{ t('show.about.emailLabel') }}</p>
              <p class="text-sm font-medium text-gray-900">contact@unmi.io</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
              <Icon name="material-symbols:language" class="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">{{ t('show.about.websiteLabel') }}</p>
              <p class="text-sm font-medium text-gray-900">unmi.io</p>
            </div>
          </div>
        </div>
        <div class="mt-6">
          <NuxtLink
            to="/show/inquiry"
            class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {{ t('show.about.sendInquiry') }}
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
