import { describe, it, expect } from 'vitest'
import { appraiseDomain } from '../server/utils/appraisal'

describe('Domain Appraisal', () => {
  it('should appraise a short .com domain highly', () => {
    const result = appraiseDomain('ai.com', '1993-01-01')
    expect(result.estimatedValue).toBeGreaterThan(100000)
    expect(result.confidence).toBe('high')
    expect(result.factors.some(f => f.includes('双字母'))).toBe(true)
  })

  it('should appraise a long domain with hyphens low', () => {
    const result = appraiseDomain('my-long-domain-name.xyz')
    expect(result.estimatedValue).toBeLessThan(50)
    expect(result.confidence).toBe('low')
  })

  it('should value .com higher than .xyz', () => {
    const com = appraiseDomain('test.com')
    const xyz = appraiseDomain('test.xyz')
    expect(com.estimatedValue).toBeGreaterThan(xyz.estimatedValue)
  })

  it('should value shorter domains higher', () => {
    const short = appraiseDomain('ab.com')
    const long = appraiseDomain('abcdefgh.com')
    expect(short.estimatedValue).toBeGreaterThan(long.estimatedValue)
  })

  it('should detect numeric domains', () => {
    const result = appraiseDomain('888.com', '1998-01-01')
    expect(result.estimatedValue).toBeGreaterThan(10000)
    expect(result.factors.some(f => f.includes('数字'))).toBe(true)
  })

  it('should value old domains higher', () => {
    const old = appraiseDomain('test.com', '1995-01-01')
    const young = appraiseDomain('test.com', '2025-01-01')
    expect(old.estimatedValue).toBeGreaterThan(young.estimatedValue)
  })

  it('should return CNY conversion', () => {
    const result = appraiseDomain('example.com')
    expect(result.estimatedValueCNY).toBe(Math.round(result.estimatedValue * 7.2))
  })

  it('should include domain name in result (lowercased)', () => {
    const result = appraiseDomain('Hello.COM')
    expect(result.domain).toBe('hello.com')
  })

  it('should include appraisedAt timestamp', () => {
    const result = appraiseDomain('test.com')
    expect(result.appraisedAt).toBeTruthy()
    expect(new Date(result.appraisedAt).getTime()).not.toBeNaN()
  })

  it('should return breakdown scores', () => {
    const result = appraiseDomain('test.com')
    expect(result.breakdown).toBeDefined()
    expect(result.breakdown.lengthScore).toBeGreaterThan(0)
    expect(result.breakdown.compositionScore).toBeGreaterThan(0)
    expect(result.breakdown.patternScore).toBeGreaterThan(0)
    expect(result.breakdown.ageScore).toBeGreaterThan(0)
    expect(result.breakdown.totalScore).toBeGreaterThan(0)
  })

  it('should give high composition score to pure letter domains', () => {
    const result = appraiseDomain('hello.com')
    expect(result.breakdown.compositionScore).toBe(100)
  })

  it('should penalize hyphens in composition score', () => {
    const result = appraiseDomain('my-site.com')
    expect(result.breakdown.compositionScore).toBe(20)
  })

  it('should detect premium keywords', () => {
    const result = appraiseDomain('cloud.com')
    expect(result.factors.some(f => f.includes('关键词'))).toBe(true)
  })

  it('should give medium confidence for mid-tier domains', () => {
    const result = appraiseDomain('somethinglong.com')
    expect(result.confidence).toBe('medium')
  })

  it('should handle multi-level TLDs', () => {
    const result = appraiseDomain('test.com.cn')
    expect(result.domain).toBe('test.com.cn')
    expect(result.factors.some(f => f.includes('com.cn'))).toBe(true)
  })

  it('should handle unknown TLDs gracefully', () => {
    const result = appraiseDomain('test.unknowntld')
    expect(result.estimatedValue).toBeGreaterThan(0)
    expect(result.factors.length).toBeGreaterThan(0)
  })

  it('should give default age score when no registration date', () => {
    const result = appraiseDomain('test.com')
    expect(result.breakdown.ageScore).toBe(30)
  })

  it('should detect CVCV pattern', () => {
    const result = appraiseDomain('dote.com')
    expect(result.factors.some(f => f.includes('CVCV'))).toBe(true)
  })

  it('should detect repeating digit domains', () => {
    const result = appraiseDomain('888.com', '2000-01-01')
    expect(result.factors.some(f => f.includes('重复数字'))).toBe(true)
  })
})
