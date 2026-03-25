<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const domainInput = ref('')
const loading = ref(false)
const result = ref<any>(null)
const pricing = ref<any>(null)
const error = ref('')
const history = ref<any[]>([])
const copiedRaw = ref(false)
const showRawText = ref(false)

async function queryWhois() {
  const domain = domainInput.value.trim()
  if (!domain) {
    toast.warning(t('domains.form.enterDomainFirst'))
    return
  }

  loading.value = true
  error.value = ''
  result.value = null
  pricing.value = null
  showRawText.value = false

  // Extract TLD for pricing query
  const parts = domain.split('.')
  const tld = parts.length >= 2 ? parts.slice(1).join('.') : ''

  try {
    // Query WHOIS and pricing in parallel
    const [whoisRes, pricingRes] = await Promise.allSettled([
      $fetch('/api/whois/query', { method: 'POST', body: { domain } }),
      tld ? $fetch(`/api/pricing/query?tld=${encodeURIComponent(tld)}`) : Promise.resolve(null),
    ])

    if (whoisRes.status === 'fulfilled') {
      result.value = whoisRes.value
    } else {
      throw whoisRes.reason
    }

    if (pricingRes.status === 'fulfilled' && pricingRes.value) {
      pricing.value = pricingRes.value
    }

    fetchHistory()
  } catch (e: any) {
    const msg = e?.data?.message || e?.data?.statusMessage || e?.message || t('common.failed')
    error.value = msg
    toast.error(msg)
  } finally {
    loading.value = false
  }
}

function clearQuery() {
  domainInput.value = ''
  result.value = null
  error.value = ''
  showRawText.value = false
}

async function fetchHistory() {
  try {
    history.value = await $fetch('/api/whois/history')
  } catch {
    // silently fail
  }
}

function queryFromHistory(domain: string) {
  domainInput.value = domain
  queryWhois()
}

async function copyRawText() {
  if (!result.value?.rawText) return
  try {
    await navigator.clipboard.writeText(result.value.rawText)
    copiedRaw.value = true
    toast.success(t('common.copied'))
    setTimeout(() => { copiedRaw.value = false }, 2000)
  } catch {
    toast.error(t('common.failed'))
  }
}

function importDomain() {
  if (!result.value) return
  const r = result.value
  const params = new URLSearchParams()
  params.set('domain', domainInput.value.trim().toLowerCase())
  if (r.registrar) params.set('registrar', r.registrar)
  if (r.registrationDate) params.set('registration_date', r.registrationDate.split('T')[0])
  if (r.expiryDate) params.set('expiry_date', r.expiryDate.split('T')[0])
  if (r.nameservers?.length) params.set('dns_servers', r.nameservers.join(', '))
  router.push(`/domains/create?${params.toString()}`)
}

// Remaining days calculation
function getRemainingDays(expiryDate: string | null): string {
  if (!expiryDate) return '-'
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return t('whois.expiredDays', { n: Math.abs(diff) })
  return t('daysRemaining.days', { n: diff })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// EPP status code explanations
const eppKeys = [
  'clienttransferprohibited', 'clientupdateprohibited', 'clientdeleteprohibited',
  'clientrenewprohibited', 'clienthold', 'servertransferprohibited',
  'serverupdateprohibited', 'serverdeleteprohibited', 'serverrenewprohibited',
  'serverhold', 'ok', 'active', 'addperiod', 'autorenewperiod', 'inactive',
  'pendingcreate', 'pendingdelete', 'pendingrenew', 'pendingrestore',
  'pendingtransfer', 'pendingupdate', 'redemptionperiod', 'renewperiod', 'transferperiod',
] as const

const statusExplanations = computed(() => {
  const map: Record<string, string> = {}
  for (const key of eppKeys) {
    map[key] = t(`whois.epp.${key}`)
  }
  return map
})

function getStatusExplanation(status: string): string {
  // Strip URL part if present (e.g., "clientTransferProhibited https://...")
  const code = status.split(/\s+/)[0].toLowerCase()
  return statusExplanations.value[code] || ''
}

function getStatusCode(status: string): string {
  return status.split(/\s+/)[0]
}

function formatPriceDisplay(price: number | null, currency: string): string {
  if (price === null) return '-'
  if (currency === 'cny') return `¥${price.toFixed(2)}`
  if (currency === 'usd') return `$${price.toFixed(2)}`
  if (currency === 'eur') return `€${price.toFixed(2)}`
  return `${price.toFixed(2)}`
}

onMounted(() => {
  fetchHistory()

  // Auto-query from URL params
  const route = useRoute()
  if (route.query.domain) {
    domainInput.value = String(route.query.domain)
    queryWhois()
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <!-- Query input -->
    <div class="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h3 class="mb-4 text-base font-semibold text-gray-800">{{ t('whois.title') }}</h3>
      <div class="flex gap-3">
        <div class="relative flex-1">
          <Icon
            name="material-symbols:search"
            class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
          />
          <input
            v-model="domainInput"
            type="text"
            :placeholder="t('whois.inputPlaceholder')"
            class="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @keydown.enter="queryWhois"
          />
        </div>
        <button
          :disabled="loading"
          class="h-11 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          @click="queryWhois"
        >
          <div v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <Icon v-else name="material-symbols:search" class="h-4 w-4" />
          {{ t('whois.query') }}
        </button>
        <button
          class="h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          @click="clearQuery"
        >
          {{ t('whois.clear') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <span class="text-sm text-gray-500">{{ t('whois.querying') }}</span>
        <span class="text-xs text-gray-400">{{ t('whois.queryingNote') }}</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
      <Icon name="material-symbols:error-outline" class="mx-auto mb-2 h-10 w-10 text-red-400" />
      <p class="text-sm text-red-700">{{ error }}</p>
      <button
        class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors"
        @click="queryWhois"
      >
        {{ t('whois.retry') }}
      </button>
    </div>

    <!-- Result -->
    <template v-else-if="result">
      <!-- Action bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-gray-800">{{ domainInput.trim().toLowerCase() }}</span>
          <span
            v-if="result.source"
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="result.source === 'rdap' || result.source === 'RDAP' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ result.source }}
          </span>
        </div>
        <button
          v-if="result.registered"
          class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          @click="importDomain"
        >
          <Icon name="material-symbols:add-circle-outline" class="h-4 w-4" />
          {{ t('whois.importDomain') }}
        </button>
      </div>

      <!-- 注册状态 card -->
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-3">
          <h4 class="text-sm font-medium text-gray-500">{{ t('whois.regStatus') }}</h4>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
            :class="result.registered ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
          >
            {{ result.registered ? t('whois.registered') : t('whois.notRegistered') }}
          </span>
        </div>
      </div>

      <!-- 基本信息 card -->
      <div v-if="result.registered" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('whois.basicInfo') }}</h3>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.domain') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ domainInput.trim().toLowerCase() }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.registrar') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ result.registrar || '-' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.regDate') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ formatDate(result.registrationDate) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.expiryDate') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ formatDate(result.expiryDate) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.updateDate') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ formatDate(result.updatedDate) }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.remainingDays') }}</p>
            <p
              class="text-sm font-medium"
              :class="result.expiryDate && new Date(result.expiryDate) < new Date() ? 'text-red-600' : 'text-gray-800'"
            >
              {{ getRemainingDays(result.expiryDate) }}
            </p>
          </div>
          <div v-if="result.registrantOrg" class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.registrant') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ result.registrantOrg }}</p>
          </div>
          <div v-if="result.registrantCountry" class="space-y-1">
            <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">{{ t('whois.registrantCountry') }}</p>
            <p class="text-sm font-medium text-gray-800">{{ result.registrantCountry }}</p>
          </div>
        </div>
      </div>

      <!-- Name Servers card -->
      <div v-if="result.nameservers?.length" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('whois.nameServers') }}</h3>
        </div>
        <div class="p-5">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="ns in result.nameservers"
              :key="ns"
              class="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-mono text-blue-700"
            >
              {{ ns }}
            </span>
          </div>
        </div>
      </div>

      <!-- 域名状态 card -->
      <div v-if="result.status?.length" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="text-base font-semibold text-gray-800">{{ t('whois.domainStatus') }}</h3>
        </div>
        <div class="p-5 space-y-2">
          <div
            v-for="s in result.status"
            :key="s"
            class="flex items-center gap-3 text-sm"
          >
            <span class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
              {{ getStatusCode(s) }}
            </span>
            <span v-if="getStatusExplanation(s)" class="text-gray-500">{{ getStatusExplanation(s) }}</span>
          </div>
        </div>
      </div>

      <!-- DNSSEC & 数据来源 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-if="result.dnssec" class="rounded-xl bg-white shadow-sm border border-gray-100 p-5">
          <h4 class="text-sm font-medium text-gray-500 mb-2">{{ t('whois.dnssec') }}</h4>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="result.dnssec === 'signedDelegation' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
          >
            {{ result.dnssec === 'signedDelegation' ? t('whois.signed') : result.dnssec }}
          </span>
        </div>
        <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5">
          <h4 class="text-sm font-medium text-gray-500 mb-2">{{ t('whois.dataSource') }}</h4>
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="result.source === 'rdap' || result.source === 'RDAP' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'"
            >
              {{ result.source }}
            </span>
            <span v-if="result.whoisServer" class="text-xs text-gray-400">
              {{ result.whoisServer }}
            </span>
          </div>
        </div>
      </div>

      <!-- 原始 WHOIS 信息 -->
      <div v-if="result.rawText" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <button
          class="flex w-full items-center justify-between border-b border-gray-100 px-5 py-4 hover:bg-gray-50 transition-colors"
          @click="showRawText = !showRawText"
        >
          <h3 class="text-base font-semibold text-gray-800">{{ t('whois.rawWhois') }}</h3>
          <div class="flex items-center gap-2">
            <button
              v-if="showRawText"
              class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              @click.stop="copyRawText"
            >
              <Icon :name="copiedRaw ? 'material-symbols:check' : 'material-symbols:content-copy'" class="h-3.5 w-3.5" />
              {{ copiedRaw ? t('common.copied') : t('common.copy') }}
            </button>
            <Icon
              :name="showRawText ? 'material-symbols:expand-less' : 'material-symbols:expand-more'"
              class="h-5 w-5 text-gray-400"
            />
          </div>
        </button>
        <div v-if="showRawText" class="p-5">
          <pre class="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-300 font-mono leading-relaxed">{{ result.rawText }}</pre>
        </div>
      </div>
      <!-- 续费价格比较 -->
      <div v-if="pricing && pricing.prices?.length" class="rounded-xl bg-white shadow-sm border border-gray-100">
        <div class="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-800 flex items-center gap-2">
            {{ t('whois.pricingComparison') }}
            <span class="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">.{{ pricing.tld }}</span>
          </h3>
          <a
            href="https://www.nazhumi.com/"
            target="_blank"
            class="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
          >
            {{ t('whois.dataFrom') }}
            <Icon name="material-symbols:open-in-new" class="w-3 h-3" />
          </a>
        </div>
        <!-- Summary cards -->
        <div class="grid grid-cols-3 gap-4 p-5 pb-0">
          <div v-if="pricing.cheapestNew" class="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
            <p class="text-xs text-green-600 font-medium mb-1">{{ t('whois.lowestNew') }}</p>
            <p class="text-lg font-bold text-green-700">{{ formatPriceDisplay(pricing.cheapestNew.newPrice, pricing.cheapestNew.currency) }}</p>
            <p class="text-xs text-green-500 mt-0.5">{{ pricing.cheapestNew.registrarName }}</p>
          </div>
          <div v-if="pricing.cheapestRenew" class="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
            <p class="text-xs text-blue-600 font-medium mb-1">{{ t('whois.lowestRenew') }}</p>
            <p class="text-lg font-bold text-blue-700">{{ formatPriceDisplay(pricing.cheapestRenew.renewPrice, pricing.cheapestRenew.currency) }}</p>
            <p class="text-xs text-blue-500 mt-0.5">{{ pricing.cheapestRenew.registrarName }}</p>
          </div>
          <div v-if="pricing.cheapestTransfer" class="rounded-lg bg-purple-50 border border-purple-100 p-3 text-center">
            <p class="text-xs text-purple-600 font-medium mb-1">{{ t('whois.lowestTransfer') }}</p>
            <p class="text-lg font-bold text-purple-700">{{ formatPriceDisplay(pricing.cheapestTransfer.transferPrice, pricing.cheapestTransfer.currency) }}</p>
            <p class="text-xs text-purple-500 mt-0.5">{{ pricing.cheapestTransfer.registrarName }}</p>
          </div>
        </div>
        <!-- Price table -->
        <div class="overflow-x-auto p-5">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="py-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase">{{ t('whois.registrar') }}</th>
                <th class="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('whois.newPrice') }}</th>
                <th class="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('whois.renewPrice') }}</th>
                <th class="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('whois.transferPrice') }}</th>
                <th class="py-2 pl-3 text-right text-xs font-medium text-gray-500 uppercase">{{ t('pricing.currency') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="p in pricing.prices" :key="p.registrar" class="hover:bg-gray-50/50 transition-colors">
                <td class="py-2.5 pr-4">
                  <a
                    v-if="p.registrarWeb"
                    :href="p.registrarWeb"
                    target="_blank"
                    class="text-blue-600 hover:text-blue-700 font-medium"
                  >{{ p.registrarName }}</a>
                  <span v-else class="font-medium text-gray-900">{{ p.registrarName }}</span>
                  <span v-if="p.hasPromoNew || p.hasPromoRenew" class="ml-1 text-xs text-orange-500">{{ t('pricing.promo') }}</span>
                </td>
                <td class="py-2.5 px-3 text-right tabular-nums" :class="pricing.cheapestNew?.registrar === p.registrar && p.newPrice !== null ? 'text-green-600 font-semibold' : 'text-gray-700'">
                  {{ p.newPrice !== null ? formatPriceDisplay(p.newPrice, p.currency) : '-' }}
                </td>
                <td class="py-2.5 px-3 text-right tabular-nums" :class="pricing.cheapestRenew?.registrar === p.registrar && p.renewPrice !== null ? 'text-blue-600 font-semibold' : 'text-gray-700'">
                  {{ p.renewPrice !== null ? formatPriceDisplay(p.renewPrice, p.currency) : '-' }}
                </td>
                <td class="py-2.5 px-3 text-right tabular-nums" :class="pricing.cheapestTransfer?.registrar === p.registrar && p.transferPrice !== null ? 'text-purple-600 font-semibold' : 'text-gray-700'">
                  {{ p.transferPrice !== null ? formatPriceDisplay(p.transferPrice, p.currency) : '-' }}
                </td>
                <td class="py-2.5 pl-3 text-right text-xs text-gray-500">{{ p.currencyName }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- 查询历史 -->
    <div v-if="history.length > 0" class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="border-b border-gray-100 px-5 py-4">
        <h3 class="text-base font-semibold text-gray-800">{{ t('whois.queryHistory') }}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-left">
              <th class="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('whois.domain') }}</th>
              <th class="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('domains.status') }}</th>
              <th class="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('whois.queryTime') }}</th>
              <th class="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('common.operations') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="item in history" :key="item.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-5 py-3 font-medium text-gray-700">{{ item.domain }}</td>
              <td class="px-5 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                >
                  {{ item.status === 'success' ? t('common.success') : t('common.failed') }}
                </span>
              </td>
              <td class="px-5 py-3 text-gray-500">{{ item.queried_at }}</td>
              <td class="px-5 py-3">
                <button
                  class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  @click="queryFromHistory(item.domain)"
                >
                  {{ t('whois.queryAgain') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
