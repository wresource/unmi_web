import zhCN from '~/i18n/zh-CN.json'
import en from '~/i18n/en.json'

type Messages = typeof zhCN
type Locale = 'zh-CN' | 'en'

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  en: en as unknown as Messages,
}

const currentLocale = ref<Locale>('zh-CN')

// Persist locale choice
if (import.meta.client) {
  const saved = localStorage.getItem('locale') as Locale | null
  if (saved && messages[saved]) {
    currentLocale.value = saved
  }
}

/**
 * Get a nested value from an object by dot-separated key path.
 * e.g. get(obj, 'auth.errors.passwordRequired')
 */
function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path
    current = current[key]
  }
  return typeof current === 'string' ? current : path
}

/**
 * Replace template variables: {n}, {name}, {range}, {cost}, {year}
 */
function interpolate(template: string, params?: Record<string, any>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`
  })
}

export function useI18n() {
  /**
   * Translate a key path with optional interpolation params.
   * Usage: t('auth.login') or t('common.total', { n: 42 })
   */
  function t(key: string, params?: Record<string, any>): string {
    const msg = getNestedValue(messages[currentLocale.value], key)
    return interpolate(msg, params)
  }

  function setLocale(locale: Locale) {
    currentLocale.value = locale
    if (import.meta.client) {
      localStorage.setItem('locale', locale)
      // Update html lang attribute
      document.documentElement.lang = locale === 'zh-CN' ? 'zh' : 'en'
    }
  }

  function toggleLocale() {
    setLocale(currentLocale.value === 'zh-CN' ? 'en' : 'zh-CN')
  }

  const locale = computed(() => currentLocale.value)
  const isZh = computed(() => currentLocale.value === 'zh-CN')
  const isEn = computed(() => currentLocale.value === 'en')

  return {
    t,
    locale,
    isZh,
    isEn,
    setLocale,
    toggleLocale,
  }
}
