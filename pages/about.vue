<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t, isZh } = useI18n()

const version = '2.1.0'

const techStack = [
  { name: 'Nuxt.js 3', desc: isZh.value ? '全栈 Vue 框架' : 'Full-stack Vue framework', icon: 'material-symbols:code', color: 'bg-green-50 text-green-600' },
  { name: 'SQLite', desc: isZh.value ? '嵌入式数据库 (WAL 模式)' : 'Embedded DB (WAL mode)', icon: 'material-symbols:database', color: 'bg-blue-50 text-blue-600' },
  { name: 'Tailwind CSS', desc: isZh.value ? '原子化 CSS 框架' : 'Utility-first CSS', icon: 'material-symbols:palette', color: 'bg-cyan-50 text-cyan-600' },
  { name: 'ECharts', desc: isZh.value ? '数据可视化图表' : 'Data visualization', icon: 'material-symbols:bar-chart', color: 'bg-purple-50 text-purple-600' },
  { name: 'TypeScript', desc: isZh.value ? '类型安全的 JavaScript' : 'Type-safe JavaScript', icon: 'material-symbols:language', color: 'bg-indigo-50 text-indigo-600' },
  { name: 'WebAuthn', desc: isZh.value ? 'Passkey / FIDO2 认证' : 'Passkey / FIDO2 auth', icon: 'material-symbols:fingerprint', color: 'bg-amber-50 text-amber-600' },
  { name: 'ECDSA P-256', desc: isZh.value ? '设备加密认证' : 'Cryptographic device auth', icon: 'material-symbols:security', color: 'bg-red-50 text-red-600' },
  { name: 'Nodemailer', desc: isZh.value ? '邮件通知' : 'Email notifications', icon: 'material-symbols:mail', color: 'bg-orange-50 text-orange-600' },
  { name: 'PM2', desc: isZh.value ? '进程管理器' : 'Process manager', icon: 'material-symbols:memory', color: 'bg-gray-100 text-gray-600' },
]

const stats = [
  { label: isZh.value ? '页面' : 'Pages', value: '22' },
  { label: 'API', value: '55+' },
  { label: isZh.value ? '数据表' : 'Tables', value: '18' },
  { label: isZh.value ? '组件' : 'Components', value: '10' },
  { label: 'i18n', value: '900+' },
  { label: isZh.value ? '工具模块' : 'Utilities', value: '8' },
]

const securityFeatures = [
  { icon: 'material-symbols:lock', title: 'AES-256-GCM', desc: isZh.value ? '敏感数据加密存储' : 'Encrypted sensitive data' },
  { icon: 'material-symbols:fingerprint', title: isZh.value ? 'Passkey / WebAuthn' : 'Passkey / WebAuthn', desc: isZh.value ? '指纹/面部识别登录' : 'Biometric login (FIDO2)' },
  { icon: 'material-symbols:smartphone', title: isZh.value ? '设备加密认证' : 'Device Crypto Auth', desc: isZh.value ? 'ECDSA P-256 不可导出私钥' : 'ECDSA P-256 non-extractable key' },
  { icon: 'material-symbols:pin', title: 'TOTP (2FA)', desc: isZh.value ? 'Google Authenticator 兼容' : 'Google Authenticator compatible' },
  { icon: 'material-symbols:speed', title: isZh.value ? 'API 速率限制' : 'API Rate Limiting', desc: isZh.value ? '令牌桶算法，按 IP 限流' : 'Token bucket, per-IP throttle' },
  { icon: 'material-symbols:shield', title: isZh.value ? '密码哈希' : 'Password Hashing', desc: 'bcrypt (10 rounds salt)' },
]
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <!-- Hero -->
    <div class="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white shadow-lg">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur text-2xl font-bold">
        DM
      </div>
      <h1 class="text-2xl font-bold">UNMI.IO</h1>
      <p class="mt-1 text-blue-200 text-sm">{{ isZh ? '域名资产管理与展示平台' : 'Domain Asset Management & Showcase Platform' }}</p>
      <div class="mt-4 flex items-center justify-center gap-4">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-sm font-mono">
          v{{ version }}
        </span>
        <a href="https://www.npmjs.com/package/unmi-domain-manager" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/80 text-sm hover:bg-red-500 transition-colors">
          <Icon name="material-symbols:package-2" class="w-4 h-4" />
          npm
        </a>
        <a href="https://github.com/wresource/unmi_web" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-sm hover:bg-white/25 transition-colors">
          GitHub
        </a>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
      <div v-for="s in stats" :key="s.label" class="rounded-xl bg-white border border-gray-100 p-3 text-center shadow-sm">
        <p class="text-xl font-bold text-gray-900">{{ s.value }}</p>
        <p class="text-xs text-gray-400">{{ s.label }}</p>
      </div>
    </div>

    <!-- Version & License -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center">
        <Icon name="material-symbols:tag" class="mx-auto mb-2 h-6 w-6 text-blue-500" />
        <p class="text-xs text-gray-400 mb-1">{{ t('about.version') }}</p>
        <p class="text-lg font-bold text-gray-800">v{{ version }}</p>
      </div>
      <a href="https://github.com/wresource/unmi_web" target="_blank" rel="noopener"
        class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center hover:shadow-md hover:border-gray-200 transition-all group">
        <Icon name="material-symbols:code" class="mx-auto mb-2 h-6 w-6 text-gray-700 group-hover:text-gray-900" />
        <p class="text-xs text-gray-400 mb-1">GitHub</p>
        <p class="text-sm font-semibold text-gray-800 group-hover:text-blue-600">wresource/unmi_web</p>
      </a>
      <div class="rounded-xl bg-white shadow-sm border border-gray-100 p-5 text-center">
        <Icon name="material-symbols:license" class="mx-auto mb-2 h-6 w-6 text-green-500" />
        <p class="text-xs text-gray-400 mb-1">{{ t('about.license') }}</p>
        <p class="text-sm font-semibold text-gray-800">MIT License</p>
      </div>
    </div>

    <!-- Quick Install -->
    <div class="rounded-xl bg-gray-900 p-5 shadow-sm">
      <p class="text-xs text-gray-400 mb-2 font-mono">$ npm install</p>
      <code class="text-green-400 text-sm font-mono">npm install unmi-domain-manager</code>
    </div>

    <!-- Security -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Icon name="material-symbols:shield" class="h-5 w-5 text-green-600" />
        <h3 class="text-base font-semibold text-gray-800">{{ t('about.securityDesign') }}</h3>
      </div>
      <div class="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="f in securityFeatures" :key="f.title" class="rounded-lg border border-gray-100 p-4 hover:bg-gray-50/50 transition-colors">
          <div class="flex items-center gap-2 mb-1.5">
            <Icon :name="f.icon" class="h-4 w-4 text-green-500 shrink-0" />
            <h4 class="text-sm font-semibold text-gray-800">{{ f.title }}</h4>
          </div>
          <p class="text-xs text-gray-400">{{ f.desc }}</p>
        </div>
      </div>
    </div>

    <!-- Tech Stack -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100">
      <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Icon name="material-symbols:layers" class="h-5 w-5 text-blue-600" />
        <h3 class="text-base font-semibold text-gray-800">{{ t('about.techStack') }}</h3>
      </div>
      <div class="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="tech in techStack" :key="tech.name" class="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50/50 transition-colors">
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

    <!-- Footer -->
    <div class="pb-4 text-center text-xs text-gray-400">
      Built with Nuxt.js · Open Source on
      <a href="https://github.com/wresource/unmi_web" target="_blank" class="text-blue-500 hover:text-blue-600">GitHub</a>
      · Published on
      <a href="https://www.npmjs.com/package/unmi-domain-manager" target="_blank" class="text-red-500 hover:text-red-600">npm</a>
    </div>
  </div>
</template>
