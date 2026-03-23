<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const VChart = defineAsyncComponent(() => import('vue-echarts'))
const toast = useToast()

// Filters
const timeRange = ref('12m')
const registrarFilter = ref('')
const tldFilter = ref('')

const timeRangeOptions = computed(() => [
  { label: t('statistics.last3m'), value: '3m' },
  { label: t('statistics.last6m'), value: '6m' },
  { label: t('statistics.last12m'), value: '12m' },
  { label: t('statistics.last24m'), value: '24m' },
  { label: t('statistics.allTime'), value: 'all' },
])

const timeRangeLabel = computed(() => {
  return timeRangeOptions.value.find(o => o.value === timeRange.value)?.label || ''
})

// Data
const loading = ref(true)
const stats = ref<any>(null)

async function fetchStats() {
  loading.value = true
  try {
    stats.value = await $fetch('/api/domains/stats', {
      params: {
        time_range: timeRange.value,
        registrar: registrarFilter.value || undefined,
        tld: tldFilter.value || undefined,
      },
    })
  } catch (e: any) {
    toast.error(e?.data?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

watch([timeRange, registrarFilter, tldFilter], () => fetchStats())
onMounted(() => fetchStats())

// Helper
function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '¥0'
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

function remainingDaysClass(days: number): string {
  if (days <= 7) return 'text-red-600 bg-red-50'
  if (days <= 30) return 'text-orange-600 bg-orange-50'
  if (days <= 90) return 'text-yellow-600 bg-yellow-50'
  return 'text-green-600 bg-green-50'
}

// Chart options
const monthlyTrendOption = computed(() => {
  const data = stats.value?.monthly_trend ?? []
  if (!data.length) return null

  const renewalCostLabel = t('dashboard.renewalAmount')
  const domainCountLabel = t('dashboard.domainCount')

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    legend: { data: [renewalCostLabel, domainCountLabel], bottom: 0, textStyle: { fontSize: 12, color: '#6b7280' } },
    grid: { top: 16, right: 50, bottom: 36, left: 60, containLabel: false },
    xAxis: {
      type: 'category',
      data: data.map((d: any) => d.month),
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', axisLabel: { fontSize: 11, color: '#9ca3af', formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      { type: 'value', axisLabel: { fontSize: 11, color: '#9ca3af' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: renewalCostLabel, type: 'bar', data: data.map((d: any) => d.cost), yAxisIndex: 0,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30,
      },
      {
        name: domainCountLabel, type: 'line', data: data.map((d: any) => d.count), yAxisIndex: 1,
        smooth: true, lineStyle: { width: 2, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' },
        symbol: 'circle', symbolSize: 6,
      },
    ],
  }
})

const registrarCostOption = computed(() => {
  const data = stats.value?.registrar_costs ?? []
  if (!data.length) return null
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#6366f1']
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12, color: '#6b7280' }, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    color: colors,
    series: [{
      name: t('domains.registrar'), type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'],
      data: data.map((d: any) => ({ name: d.registrar, value: d.cost })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    }],
  }
})

const tldDistributionOption = computed(() => {
  const data = stats.value?.tld_distribution ?? []
  if (!data.length) return null
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12, color: '#6b7280' }, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    color: colors,
    series: [{
      name: 'TLD', type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'],
      data: data.map((d: any) => ({ name: d.tld, value: d.count })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    }],
  }
})

const expiryDistOption = computed(() => {
  if (!stats.value?.expiry_distribution) return null
  const ed = stats.value.expiry_distribution
  const labels = [t('statistics.days7'), t('statistics.days30'), t('statistics.days90'), t('statistics.days365')]
  const values = [ed['7d'], ed['30d'], ed['90d'], ed['365d']]
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e']
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 16, right: 16, bottom: 24, left: 40, containLabel: false },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11, color: '#9ca3af' }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6' } }, minInterval: 1 },
    series: [{
      name: t('dashboard.domainCount'), type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] } })),
      barMaxWidth: 40,
    }],
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('statistics.title') }}</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ t('statistics.subtitle') }}</p>
      </div>
      <button
        :disabled="loading"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        @click="fetchStats"
      >
        <Icon name="material-symbols:refresh" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        {{ t('common.refresh') }}
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600">{{ t('statistics.timeRange') }}</label>
        <select
          v-model="timeRange"
          class="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option v-for="opt in timeRangeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600">{{ t('domains.registrar') }}</label>
        <select
          v-model="registrarFilter"
          class="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{{ t('common.all') }}</option>
          <option v-for="r in stats?.registrars ?? []" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600">TLD</label>
        <select
          v-model="tldFilter"
          class="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{{ t('common.all') }}</option>
          <option v-for="t in stats?.tlds ?? []" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && !stats" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <span class="text-sm text-gray-500">{{ t('common.loading') }}</span>
      </div>
    </div>

    <template v-else-if="stats">
      <!-- Overview cards -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div class="rounded-xl bg-white p-4 shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
          <p class="text-xs text-gray-500 font-medium">{{ t('statistics.totalDomains') }}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.total_domains }}</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm border border-gray-100 border-l-4 border-l-green-500">
          <p class="text-xs text-gray-500 font-medium">{{ t('statistics.activeDomains') }}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.active_domains }}</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
          <p class="text-xs text-gray-500 font-medium">{{ t('statistics.expiringLabel', { range: timeRangeLabel }) }}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.expiring_soon }}</p>
          <p class="text-xs text-gray-400 mt-0.5">{{ t('statistics.expired', { n: stats.expired }) }}</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
          <p class="text-xs text-gray-500 font-medium">{{ t('statistics.renewalBudget', { range: timeRangeLabel }) }}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ formatCurrency(stats.total_renewal_cost) }}</p>
          <p class="text-xs text-gray-400 mt-0.5">{{ t('statistics.totalRenewal') }} {{ formatCurrency(stats.all_renewal_cost) }}</p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm border border-gray-100 border-l-4 border-l-cyan-500">
          <p class="text-xs text-gray-500 font-medium">{{ t('statistics.avgPrice') }}</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ formatCurrency(stats.avg_renewal_price) }}</p>
        </div>
      </div>

      <!-- Portfolio Valuation -->
      <div v-if="stats.valuation" class="rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px]">
        <div class="rounded-xl bg-white p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="material-symbols:diamond" class="w-5 h-5 text-purple-500" />
              {{ t('statistics.valuation.title') }}
            </h3>
            <span class="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{{ t('statistics.valuation.engine') }}</span>
          </div>
          <!-- Valuation summary cards -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div class="rounded-lg bg-purple-50 border border-purple-100 p-4 text-center">
              <p class="text-xs text-purple-600 font-medium mb-1">{{ t('statistics.valuation.totalAppraisal') }}</p>
              <p class="text-xl font-bold text-purple-700">${{ stats.valuation.totalAppraisalUSD.toLocaleString() }}</p>
              <p class="text-xs text-purple-500 mt-0.5">≈ ¥{{ stats.valuation.totalAppraisalCNY.toLocaleString() }}</p>
            </div>
            <div class="rounded-lg bg-blue-50 border border-blue-100 p-4 text-center">
              <p class="text-xs text-blue-600 font-medium mb-1">{{ t('statistics.valuation.totalCost') }}</p>
              <p class="text-xl font-bold text-blue-700">{{ formatCurrency(stats.valuation.totalPurchaseCost) }}</p>
            </div>
            <div class="rounded-lg bg-amber-50 border border-amber-100 p-4 text-center">
              <p class="text-xs text-amber-600 font-medium mb-1">{{ t('statistics.valuation.annualCost') }}</p>
              <p class="text-xl font-bold text-amber-700">{{ formatCurrency(stats.valuation.totalAnnualCost) }}</p>
            </div>
            <div class="rounded-lg p-4 text-center" :class="stats.valuation.roi >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'">
              <p class="text-xs font-medium mb-1" :class="stats.valuation.roi >= 0 ? 'text-green-600' : 'text-red-600'">{{ t('statistics.valuation.roi') }}</p>
              <p class="text-xl font-bold" :class="stats.valuation.roi >= 0 ? 'text-green-700' : 'text-red-700'">
                {{ stats.valuation.roi >= 0 ? '+' : '' }}{{ stats.valuation.roi }}%
              </p>
              <p class="text-xs mt-0.5" :class="stats.valuation.roi >= 0 ? 'text-green-500' : 'text-red-500'">
                {{ stats.valuation.roi >= 0 ? t('statistics.valuation.aboveCost') : t('statistics.valuation.belowCost') }}
              </p>
            </div>
          </div>
          <!-- Domain valuation list -->
          <div v-if="stats.valuation.domains?.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="py-2 text-left text-xs font-medium text-gray-500">{{ t('domains.domainName') }}</th>
                  <th class="py-2 text-right text-xs font-medium text-gray-500">{{ t('statistics.valuation.usd') }}</th>
                  <th class="py-2 text-right text-xs font-medium text-gray-500">{{ t('statistics.valuation.cny') }}</th>
                  <th class="py-2 text-right text-xs font-medium text-gray-500">{{ t('statistics.valuation.purchasePrice') }}</th>
                  <th class="py-2 text-center text-xs font-medium text-gray-500">{{ t('statistics.valuation.confidence') }}</th>
                  <th class="py-2 text-right text-xs font-medium text-gray-500">{{ t('statistics.valuation.profitLoss') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="d in stats.valuation.domains" :key="d.domain" class="hover:bg-gray-50/50">
                  <td class="py-2.5 font-medium text-gray-900">{{ d.domain }}</td>
                  <td class="py-2.5 text-right tabular-nums text-gray-700">${{ d.value.toLocaleString() }}</td>
                  <td class="py-2.5 text-right tabular-nums text-gray-700">¥{{ d.valueCNY.toLocaleString() }}</td>
                  <td class="py-2.5 text-right tabular-nums text-gray-500">{{ d.purchasePrice ? formatCurrency(d.purchasePrice) : '-' }}</td>
                  <td class="py-2.5 text-center">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="{
                        'bg-green-100 text-green-700': d.confidence === 'high',
                        'bg-yellow-100 text-yellow-700': d.confidence === 'medium',
                        'bg-gray-100 text-gray-600': d.confidence === 'low',
                      }"
                    >
                      {{ d.confidence === 'high' ? t('statistics.valuation.high') : d.confidence === 'medium' ? t('statistics.valuation.medium') : t('statistics.valuation.low') }}
                    </span>
                  </td>
                  <td class="py-2.5 text-right tabular-nums text-sm font-medium" :class="d.purchasePrice && d.value * 7.2 > d.purchasePrice ? 'text-green-600' : d.purchasePrice ? 'text-red-600' : 'text-gray-400'">
                    {{ d.purchasePrice ? (d.value * 7.2 > d.purchasePrice ? '+' : '') + formatCurrency(d.value * 7.2 - d.purchasePrice) : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Charts row 1 -->
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Monthly trend -->
        <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('statistics.monthlyTrend') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart v-if="monthlyTrendOption" :option="monthlyTrendOption" autoresize class="w-full h-full" />
              <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
                <div class="text-center">
                  <Icon name="material-symbols:show-chart" class="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>{{ t('statistics.noRenewal', { range: timeRangeLabel }) }}</p>
                </div>
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Expiry distribution -->
        <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('statistics.expiryDist') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart v-if="expiryDistOption" :option="expiryDistOption" autoresize class="w-full h-full" />
              <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">{{ t('common.noData') }}</div>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Charts row 2 -->
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Registrar cost -->
        <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('statistics.registrarCost') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart v-if="registrarCostOption" :option="registrarCostOption" autoresize class="w-full h-full" />
              <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">{{ t('common.noData') }}</div>
            </ClientOnly>
          </div>
        </div>

        <!-- TLD distribution -->
        <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">{{ t('statistics.tldDist') }}</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart v-if="tldDistributionOption" :option="tldDistributionOption" autoresize class="w-full h-full" />
              <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">{{ t('common.noData') }}</div>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Upcoming renewal domains table -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-800">
            {{ t('statistics.upcomingRenewals', { range: timeRangeLabel }) }}
            <span v-if="stats.upcoming_domains?.length" class="text-sm font-normal text-gray-400 ml-2">
              {{ t('statistics.totalCount', { n: stats.expiring_soon, cost: formatCurrency(stats.total_renewal_cost) }) }}
            </span>
          </h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/50">
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('domains.domainName') }}</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('domains.registrar') }}</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">TLD</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('domains.expiryDate') }}</th>
                <th class="px-5 py-3 text-center font-medium text-gray-500">{{ t('domains.remainingDays') }}</th>
                <th class="px-5 py-3 text-right font-medium text-gray-500">{{ t('domains.renewalPrice') }}</th>
                <th class="px-5 py-3 text-center font-medium text-gray-500">{{ t('common.operations') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="d in stats.upcoming_domains"
                :key="d.id"
                class="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
              >
                <td class="px-5 py-3">
                  <NuxtLink :to="`/domains/${d.id}`" class="font-medium text-blue-600 hover:text-blue-700">
                    {{ d.domain_name }}
                  </NuxtLink>
                </td>
                <td class="px-5 py-3 text-gray-600">{{ d.registrar || '-' }}</td>
                <td class="px-5 py-3 text-gray-600">{{ d.tld }}</td>
                <td class="px-5 py-3 text-gray-600">{{ formatDate(d.expiry_date) }}</td>
                <td class="px-5 py-3 text-center whitespace-nowrap">
                  <span
                    :class="[remainingDaysClass(d.remaining_days), 'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium']"
                  >
                    {{ t('daysRemaining.days', { n: d.remaining_days }) }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right font-medium text-gray-800 tabular-nums">
                  {{ d.renewal_price ? formatCurrency(d.renewal_price) : '-' }}
                </td>
                <td class="px-5 py-3 text-center">
                  <NuxtLink
                    :to="`/domains/${d.id}`"
                    class="text-xs text-blue-500 hover:text-blue-700"
                  >
                    {{ t('common.view') }}
                  </NuxtLink>
                </td>
              </tr>
              <tr v-if="!stats.upcoming_domains?.length">
                <td colspan="7" class="px-5 py-10 text-center text-gray-400">
                  {{ t('statistics.noUpcoming', { range: timeRangeLabel }) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Renewal history table -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('statistics.renewalHistory') }}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/50">
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('domains.domainName') }}</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('domains.registrar') }}</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('statistics.renewalDate') }}</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">{{ t('statistics.years') }}</th>
                <th class="px-5 py-3 text-right font-medium text-gray-500">{{ t('statistics.cost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in stats.renewal_records"
                :key="r.id"
                class="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
              >
                <td class="px-5 py-3 font-medium text-gray-800">{{ r.domain }}</td>
                <td class="px-5 py-3 text-gray-600">{{ r.registrar || '-' }}</td>
                <td class="px-5 py-3 text-gray-600">{{ r.date }}</td>
                <td class="px-5 py-3 text-gray-600">{{ r.years }}</td>
                <td class="px-5 py-3 text-right font-medium text-gray-800 tabular-nums">{{ formatCurrency(r.cost) }}</td>
              </tr>
              <tr v-if="!stats.renewal_records?.length">
                <td colspan="5" class="px-5 py-10 text-center text-gray-400">{{ t('statistics.noRecords') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-else class="flex flex-col items-center justify-center py-20 text-gray-400">
      <Icon name="material-symbols:error-outline" class="mb-3 h-12 w-12" />
      <p>{{ t('common.failed') }}</p>
      <button class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" @click="fetchStats">{{ t('whois.retry') }}</button>
    </div>
  </div>
</template>
