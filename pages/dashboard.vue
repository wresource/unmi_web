<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const VChart = defineAsyncComponent(() => import('vue-echarts'))

interface StatsData {
  total: number
  expiring7: number
  expiring30: number
  expiring90: number
  expired: number
  totalRenewalCost: number
  totalHoldCost: number
  avgRenewalPrice: number
  byRegistrar: { registrar: string; count: number }[]
  byTld: { tld: string; count: number }[]
  byStatus: { status: string; count: number }[]
  monthlyRenewal: { month: string; count: number; cost: number }[]
}

interface Domain {
  id: string
  domain_name: string
  expiry_date: string
  registration_date: string
  registrar: string
  status: string
  renewal_price: number
  tld: string
  remainingDays: number | null
  created_at: string
  updated_at: string
  tags: { id: string; name: string; color: string }[]
}

interface DomainsResponse {
  data: Domain[]
  total: number
  page: number
  pageSize: number
}

const stats = ref<StatsData | null>(null)
const expiringDomains = ref<Domain[]>([])
const recentlyAdded = ref<Domain[]>([])
const recentlyUpdated = ref<Domain[]>([])
const loading = ref(true)

async function fetchData() {
  loading.value = true
  try {
    const [statsData, expiringData, addedData, updatedData] = await Promise.all([
      $fetch<StatsData>('/api/domains/stats'),
      $fetch<DomainsResponse>('/api/domains', {
        params: { sortBy: 'expiry_date', sortOrder: 'asc', pageSize: 5, expireDays: 90 },
      }),
      $fetch<DomainsResponse>('/api/domains', {
        params: { sortBy: 'created_at', sortOrder: 'desc', pageSize: 5 },
      }),
      $fetch<DomainsResponse>('/api/domains', {
        params: { sortBy: 'updated_at', sortOrder: 'desc', pageSize: 5 },
      }),
    ])
    stats.value = statsData
    expiringDomains.value = expiringData.data
    recentlyAdded.value = addedData.data
    recentlyUpdated.value = updatedData.data
  } catch (e) {
    console.error('Failed to fetch dashboard data:', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

// Chart options
const lineChartOption = computed(() => {
  if (!stats.value?.monthlyRenewal?.length) return {}
  const months = stats.value.monthlyRenewal.map((m) => m.month)
  const costs = stats.value.monthlyRenewal.map((m) => m.cost)
  const counts = stats.value.monthlyRenewal.map((m) => m.count)

  const renewalAmountLabel = t('dashboard.renewalAmount')
  const domainCountLabel = t('dashboard.domainCount')

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter(params: any[]) {
        const month = params[0].axisValue
        let html = `<div class="font-medium mb-1">${month}</div>`
        for (const p of params) {
          const marker = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>`
          const val = p.seriesName === renewalAmountLabel ? `¥${p.value.toFixed(0)}` : `${p.value}`
          html += `<div>${marker}${p.seriesName}: ${val}</div>`
        }
        return html
      },
    },
    legend: {
      data: [renewalAmountLabel, domainCountLabel],
      bottom: 0,
      textStyle: { fontSize: 12, color: '#6b7280' },
    },
    grid: { top: 16, right: 16, bottom: 36, left: 50, containLabel: false },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '',
        axisLabel: { fontSize: 11, color: '#9ca3af', formatter: '¥{value}' },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: 'value',
        name: '',
        axisLabel: { fontSize: 11, color: '#9ca3af' },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: renewalAmountLabel,
        type: 'line',
        smooth: true,
        data: costs,
        yAxisIndex: 0,
        lineStyle: { width: 2.5, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.15)' },
              { offset: 1, color: 'rgba(59,130,246,0.01)' },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: domainCountLabel,
        type: 'line',
        smooth: true,
        data: counts,
        yAxisIndex: 1,
        lineStyle: { width: 2.5, color: '#8b5cf6' },
        itemStyle: { color: '#8b5cf6' },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }
})

const pieChartOption = computed(() => {
  if (!stats.value) return {}

  const registrarData = (stats.value.byRegistrar || []).slice(0, 8).map((r) => ({
    name: r.registrar || t('dashboard.unknownRegistrar'),
    value: r.count,
  }))

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#6366f1']

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { fontSize: 12, color: '#6b7280' },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 10,
    },
    color: colors,
    series: [
      {
        name: t('dashboard.registrarDist'),
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.1)' },
        },
        labelLine: { show: false },
        data: registrarData,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      },
    ],
  }
})

// Helpers
function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10)
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '¥0'
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Calculate monthly and annual renewal budget
const monthlyBudget = computed(() => {
  if (!stats.value?.monthlyRenewal?.length) return 0
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const current = stats.value.monthlyRenewal.find((m) => m.month === currentMonth)
  return current?.cost || 0
})

const annualBudget = computed(() => {
  if (!stats.value?.monthlyRenewal?.length) return 0
  return stats.value.monthlyRenewal.reduce((sum, m) => sum + m.cost, 0)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('dashboard.title') }}</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ t('dashboard.subtitle') }}</p>
      </div>
      <button
        @click="fetchData"
        :disabled="loading"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <Icon
          name="material-symbols:refresh"
          class="w-4 h-4"
          :class="{ 'animate-spin': loading }"
        />
        {{ t('common.refresh') }}
      </button>
    </div>

    <!-- Loading Skeleton -->
    <template v-if="loading && !stats">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div v-for="i in 5" :key="i" class="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
          <div class="h-4 w-20 bg-gray-200 rounded mb-3" />
          <div class="h-8 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    </template>

    <!-- Dashboard Content -->
    <template v-else-if="stats">
      <!-- Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <CommonStatCard
          :title="t('dashboard.totalDomains')"
          :value="stats.total"
          icon="material-symbols:domain"
          color="blue"
        />
        <CommonStatCard
          :title="t('dashboard.expiringSoon')"
          :value="stats.expiring30"
          icon="material-symbols:timer-outline"
          color="yellow"
          :trend-label="t('dashboard.within7Days', { n: stats.expiring7 })"
        />
        <CommonStatCard
          :title="t('dashboard.monthlyBudget')"
          :value="formatCurrency(monthlyBudget)"
          icon="material-symbols:payments-outline"
          color="green"
        />
        <CommonStatCard
          :title="t('dashboard.annualBudget')"
          :value="formatCurrency(annualBudget)"
          icon="material-symbols:calendar-month-outline"
          color="purple"
        />
        <CommonStatCard
          :title="t('dashboard.expiredDomains')"
          :value="stats.expired"
          icon="material-symbols:warning-outline"
          color="red"
        />
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Monthly Renewal Trend -->
        <div class="bg-white rounded-xl border border-gray-100 p-5">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('dashboard.monthlyTrend') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart
                v-if="stats.monthlyRenewal?.length"
                :option="lineChartOption"
                autoresize
                class="w-full h-full"
              />
              <div
                v-else
                class="flex items-center justify-center h-full text-gray-400 text-sm"
              >
                <div class="text-center">
                  <Icon name="material-symbols:show-chart" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>{{ t('dashboard.noTrendData') }}</p>
                </div>
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Registrar Distribution -->
        <div class="bg-white rounded-xl border border-gray-100 p-5">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('dashboard.registrarDist') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart
                v-if="stats.byRegistrar?.length"
                :option="pieChartOption"
                autoresize
                class="w-full h-full"
              />
              <div
                v-else
                class="flex items-center justify-center h-full text-gray-400 text-sm"
              >
                <div class="text-center">
                  <Icon name="material-symbols:pie-chart-outline" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>{{ t('dashboard.noRegistrarData') }}</p>
                </div>
              </div>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Domain Lists Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Expiring Soon -->
        <div class="bg-white rounded-xl border border-gray-100">
          <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="material-symbols:timer-outline" class="w-4 h-4 text-amber-500" />
              {{ t('dashboard.expiringDomains') }}
            </h3>
            <NuxtLink
              to="/domains?sortBy=expiry_date&sortOrder=asc"
              class="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              {{ t('dashboard.viewAll') }}
            </NuxtLink>
          </div>
          <div class="divide-y divide-gray-50">
            <template v-if="expiringDomains.length">
              <NuxtLink
                v-for="domain in expiringDomains"
                :key="domain.id"
                :to="`/domains/${domain.id}`"
                class="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ domain.domain_name }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(domain.expiry_date) }}</p>
                </div>
                <CommonDaysRemaining
                  v-if="domain.expiry_date"
                  :expire-date="domain.expiry_date"
                />
              </NuxtLink>
            </template>
            <div v-else class="px-5 py-8 text-center text-sm text-gray-400">
              {{ t('dashboard.noExpiring') }}
            </div>
          </div>
        </div>

        <!-- Recently Added -->
        <div class="bg-white rounded-xl border border-gray-100">
          <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="material-symbols:add-circle-outline" class="w-4 h-4 text-green-500" />
              {{ t('dashboard.recentlyAdded') }}
            </h3>
            <NuxtLink
              to="/domains?sortBy=created_at&sortOrder=desc"
              class="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              {{ t('dashboard.viewAll') }}
            </NuxtLink>
          </div>
          <div class="divide-y divide-gray-50">
            <template v-if="recentlyAdded.length">
              <NuxtLink
                v-for="domain in recentlyAdded"
                :key="domain.id"
                :to="`/domains/${domain.id}`"
                class="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ domain.domain_name }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ domain.registrar || t('dashboard.unknownRegistrar') }}</p>
                </div>
                <span class="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {{ formatDate(domain.created_at) }}
                </span>
              </NuxtLink>
            </template>
            <div v-else class="px-5 py-8 text-center text-sm text-gray-400">
              {{ t('dashboard.noDomains') }}
            </div>
          </div>
        </div>

        <!-- Recently Updated -->
        <div class="bg-white rounded-xl border border-gray-100">
          <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="material-symbols:update" class="w-4 h-4 text-blue-500" />
              {{ t('dashboard.recentlyUpdated') }}
            </h3>
            <NuxtLink
              to="/domains?sortBy=updated_at&sortOrder=desc"
              class="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              {{ t('dashboard.viewAll') }}
            </NuxtLink>
          </div>
          <div class="divide-y divide-gray-50">
            <template v-if="recentlyUpdated.length">
              <NuxtLink
                v-for="domain in recentlyUpdated"
                :key="domain.id"
                :to="`/domains/${domain.id}`"
                class="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ domain.domain_name }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ domain.registrar || t('dashboard.unknownRegistrar') }}</p>
                </div>
                <span class="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {{ formatDate(domain.updated_at) }}
                </span>
              </NuxtLink>
            </template>
            <div v-else class="px-5 py-8 text-center text-sm text-gray-400">
              {{ t('dashboard.noDomains') }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
