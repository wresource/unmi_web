import { describe, it, expect } from 'vitest'

// Re-implement the private extractTld function to test its logic
// This mirrors the implementation in server/utils/pricing.ts
function extractTld(domain: string): string {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return ''

  const multiLevelTlds = [
    'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ac.uk',
    'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
    'com.au', 'net.au', 'org.au', 'edu.au',
    'co.nz', 'net.nz', 'org.nz',
    'com.br', 'net.br', 'org.br',
    'co.kr', 'or.kr', 'ne.kr',
    'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
    'com.sg', 'net.sg', 'org.sg', 'edu.sg',
    'com.my', 'net.my', 'org.my',
    'co.th', 'in.th', 'ac.th',
    'com.tw', 'net.tw', 'org.tw', 'idv.tw',
    'com.hk', 'net.hk', 'org.hk', 'idv.hk',
    'co.za', 'net.za', 'org.za', 'web.za',
    'com.mx', 'net.mx', 'org.mx',
    'com.ar', 'net.ar', 'org.ar',
    'com.tr', 'net.tr', 'org.tr',
    'com.ru', 'net.ru', 'org.ru',
    'co.il', 'org.il', 'net.il',
  ]

  if (parts.length >= 3) {
    const twoLevel = parts.slice(-2).join('.')
    if (multiLevelTlds.includes(twoLevel)) {
      return twoLevel
    }
  }

  return parts[parts.length - 1]
}

// Re-implement parsePrice to test it
function parsePrice(val: any): number | null {
  if (val === 'n/a' || val === null || val === undefined || val === '') return null
  const num = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(num) ? null : num
}

describe('Pricing TLD Extraction', () => {
  it('should extract simple TLDs', () => {
    expect(extractTld('example.com')).toBe('com')
    expect(extractTld('test.net')).toBe('net')
    expect(extractTld('site.io')).toBe('io')
    expect(extractTld('app.org')).toBe('org')
  })

  it('should extract multi-level TLDs', () => {
    expect(extractTld('example.co.uk')).toBe('co.uk')
    expect(extractTld('test.com.cn')).toBe('com.cn')
    expect(extractTld('site.co.jp')).toBe('co.jp')
    expect(extractTld('app.com.au')).toBe('com.au')
  })

  it('should handle Asian multi-level TLDs', () => {
    expect(extractTld('test.com.tw')).toBe('com.tw')
    expect(extractTld('test.com.hk')).toBe('com.hk')
    expect(extractTld('test.co.kr')).toBe('co.kr')
    expect(extractTld('test.com.sg')).toBe('com.sg')
  })

  it('should handle non-multi-level domains with 3+ parts', () => {
    // sub.example.com should return 'com' since 'example.com' is not in multiLevelTlds
    expect(extractTld('sub.example.com')).toBe('com')
  })

  it('should handle edge cases', () => {
    expect(extractTld('single')).toBe('')
    expect(extractTld('')).toBe('')
  })

  it('should handle uppercase input', () => {
    expect(extractTld('Example.COM')).toBe('com')
    expect(extractTld('Test.CO.UK')).toBe('co.uk')
  })
})

describe('Price Parsing', () => {
  it('should parse numeric values', () => {
    expect(parsePrice(9.99)).toBe(9.99)
    expect(parsePrice(0)).toBe(0)
    expect(parsePrice(100)).toBe(100)
  })

  it('should parse string numbers', () => {
    expect(parsePrice('9.99')).toBe(9.99)
    expect(parsePrice('0')).toBe(0)
    expect(parsePrice('100.50')).toBe(100.50)
  })

  it('should return null for n/a', () => {
    expect(parsePrice('n/a')).toBeNull()
  })

  it('should return null for empty/null/undefined', () => {
    expect(parsePrice(null)).toBeNull()
    expect(parsePrice(undefined)).toBeNull()
    expect(parsePrice('')).toBeNull()
  })

  it('should return null for non-numeric strings', () => {
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('not-a-number')).toBeNull()
  })
})
