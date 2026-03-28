import { describe, it, expect } from 'vitest'
import { analyzeDomain } from '../server/utils/dropcatch'

describe('Domain Analysis', () => {
  it('should analyze a simple .com domain', () => {
    const r = analyzeDomain('test.com')
    expect(r.sld).toBe('test')
    expect(r.tld).toBe('.com')
    expect(r.length).toBe(4)
    expect(r.isPureLetters).toBe(true)
    expect(r.hasNumbers).toBe(false)
    expect(r.hasHyphens).toBe(false)
    expect(r.isPureNumbers).toBe(false)
  })

  it('should detect numbers', () => {
    const r = analyzeDomain('abc123.com')
    expect(r.hasNumbers).toBe(true)
    expect(r.isPureLetters).toBe(false)
    expect(r.isPureNumbers).toBe(false)
  })

  it('should detect hyphens', () => {
    const r = analyzeDomain('my-domain.com')
    expect(r.hasHyphens).toBe(true)
    expect(r.isPureLetters).toBe(false)
    expect(r.length).toBe(9)
  })

  it('should detect pure numbers', () => {
    const r = analyzeDomain('888.com')
    expect(r.isPureNumbers).toBe(true)
    expect(r.isPureLetters).toBe(false)
    expect(r.hasNumbers).toBe(true)
    expect(r.length).toBe(3)
  })

  it('should handle multi-level TLDs', () => {
    const r = analyzeDomain('test.co.uk')
    expect(r.sld).toBe('test')
    expect(r.tld).toBe('.co.uk')
    expect(r.length).toBe(4)
  })

  it('should handle .net domains', () => {
    const r = analyzeDomain('hello.net')
    expect(r.sld).toBe('hello')
    expect(r.tld).toBe('.net')
    expect(r.length).toBe(5)
    expect(r.isPureLetters).toBe(true)
  })

  it('should handle single character domains', () => {
    const r = analyzeDomain('x.com')
    expect(r.sld).toBe('x')
    expect(r.length).toBe(1)
    expect(r.isPureLetters).toBe(true)
  })

  it('should handle mixed alphanumeric domains', () => {
    const r = analyzeDomain('a1b2.org')
    expect(r.hasNumbers).toBe(true)
    expect(r.isPureLetters).toBe(false)
    expect(r.isPureNumbers).toBe(false)
    expect(r.hasHyphens).toBe(false)
  })

  it('should measure SLD length correctly', () => {
    const r = analyzeDomain('abcdefghij.com')
    expect(r.length).toBe(10)
  })

  it('should handle uppercase domains', () => {
    const r = analyzeDomain('TEST.COM')
    expect(r.sld).toBe('TEST')
    expect(r.tld).toBe('.COM')
    expect(r.isPureLetters).toBe(true)
  })
})
