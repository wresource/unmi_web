<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

const techStack = [
  { name: 'Nuxt.js 3', desc: 'Full-stack Vue framework', icon: 'material-symbols:code', color: 'bg-green-50 text-green-600' },
  { name: 'SQLite', desc: 'Embedded database', icon: 'material-symbols:database', color: 'bg-blue-50 text-blue-600' },
  { name: 'Tailwind CSS', desc: 'Utility-first CSS', icon: 'material-symbols:palette', color: 'bg-cyan-50 text-cyan-600' },
  { name: 'Vue ECharts', desc: 'Data visualization', icon: 'material-symbols:bar-chart', color: 'bg-purple-50 text-purple-600' },
  { name: 'Pinia', desc: 'State management', icon: 'material-symbols:data-object', color: 'bg-amber-50 text-amber-600' },
  { name: 'TypeScript', desc: 'Type-safe JavaScript', icon: 'material-symbols:language', color: 'bg-indigo-50 text-indigo-600' },
]

const securityFeatures = computed(() => [
  { title: t('about.localFirst'), desc: '' },
  { title: t('about.encrypted'), desc: '' },
  { title: t('about.openSource'), desc: '' },
  { title: t('about.multiAccount'), desc: '' },
])
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <!-- Project intro -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-8 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow-lg shadow-blue-600/30">
        DM
      </div>
      <h1 class="text-2xl font-bold text-gray-800">{{ t('about.projectName') }}</h1>
      <p class="mt-1 text-sm text-gray-500">Domain Manager</p>
    </div>

    <!-- Version & links -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center">
        <Icon name="material-symbols:tag" class="mx-auto mb-2 h-6 w-6 text-blue-500" />
        <p class="text-xs text-gray-400 mb-1">{{ t('about.version') }}</p>
        <p class="text-lg font-bold text-gray-800">v1.0.0</p>
      </div>
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center hover:shadow-md hover:border-gray-200 transition-all group"
      >
        <Icon name="material-symbols:code" class="mx-auto mb-2 h-6 w-6 text-gray-700 group-hover:text-gray-900" />
        <p class="text-xs text-gray-400 mb-1">GitHub</p>
        <p class="text-sm font-semibold text-gray-800 group-hover:text-blue-600">GitHub</p>
      </a>
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center">
        <Icon name="material-symbols:license" class="mx-auto mb-2 h-6 w-6 text-green-500" />
        <p class="text-xs text-gray-400 mb-1">{{ t('about.license') }}</p>
        <p class="text-sm font-semibold text-gray-800">MIT License</p>
      </div>
    </div>

    <!-- Security design -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Icon name="material-symbols:shield" class="h-5 w-5 text-green-600" />
        <h3 class="text-base font-semibold text-gray-800">{{ t('about.securityDesign') }}</h3>
      </div>
      <div class="p-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="feature in securityFeatures"
            :key="feature.title"
            class="rounded-lg border border-gray-100 p-4 hover:bg-gray-50/50 transition-colors"
          >
            <div class="flex items-center gap-2 mb-2">
              <Icon name="material-symbols:check-circle" class="h-4 w-4 text-green-500 shrink-0" />
              <h4 class="text-sm font-semibold text-gray-800">{{ feature.title }}</h4>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tech stack -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Icon name="material-symbols:layers" class="h-5 w-5 text-blue-600" />
        <h3 class="text-base font-semibold text-gray-800">{{ t('about.techStack') }}</h3>
      </div>
      <div class="p-6">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="tech in techStack"
            :key="tech.name"
            class="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50/50 transition-colors"
          >
            <div :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tech.color]">
              <Icon :name="tech.icon" class="h-4.5 w-4.5" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-800">{{ tech.name }}</p>
              <p class="text-xs text-gray-400">{{ tech.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="pb-4 text-center text-xs text-gray-400">
      Built with Nuxt.js &middot; Made for domain management
    </div>
  </div>
</template>
