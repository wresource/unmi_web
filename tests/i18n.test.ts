import { describe, it, expect } from 'vitest'
import zhCN from '../i18n/zh-CN.json'
import en from '../i18n/en.json'

function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

describe('i18n Translation Completeness', () => {
  const zhKeys = getAllKeys(zhCN)
  const enKeys = getAllKeys(en)

  it('should have matching key counts', () => {
    expect(zhKeys.length).toBe(enKeys.length)
  })

  it('should have all zh-CN keys in en', () => {
    const missing = zhKeys.filter(k => !enKeys.includes(k))
    expect(missing).toEqual([])
  })

  it('should have all en keys in zh-CN', () => {
    const missing = enKeys.filter(k => !zhKeys.includes(k))
    expect(missing).toEqual([])
  })

  it('should have no empty values in zh-CN', () => {
    const emptyZh = zhKeys.filter(k => {
      const val = k.split('.').reduce((o: any, p) => o?.[p], zhCN)
      return val === '' || val === null || val === undefined
    })
    expect(emptyZh).toEqual([])
  })

  it('should have no empty values in en', () => {
    const emptyEn = enKeys.filter(k => {
      const val = k.split('.').reduce((o: any, p) => o?.[p], en)
      return val === '' || val === null || val === undefined
    })
    expect(emptyEn).toEqual([])
  })

  it('should have essential common keys', () => {
    expect(zhKeys).toContain('common.confirm')
    expect(zhKeys).toContain('common.cancel')
    expect(zhKeys).toContain('common.save')
    expect(zhKeys).toContain('common.delete')
    expect(zhKeys).toContain('common.search')
  })

  it('should have essential auth keys', () => {
    expect(zhKeys).toContain('auth.login')
  })

  it('should have essential feature keys', () => {
    expect(zhKeys).toContain('domains.title')
    expect(zhKeys).toContain('show.heroTitle')
    expect(zhKeys).toContain('dropcatch.title')
    expect(zhKeys).toContain('security.totp.title')
    expect(zhKeys).toContain('notifications.title')
    expect(zhKeys).toContain('email.title')
  })

  it('should have matching top-level sections', () => {
    const zhSections = Object.keys(zhCN).sort()
    const enSections = Object.keys(en).sort()
    expect(zhSections).toEqual(enSections)
  })
})
