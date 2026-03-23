// ============================================================================
// Domain Appraisal Engine
//
// A rule-based domain valuation system that estimates domain value based on:
// - TLD tier & market value
// - Domain name length (shorter = more valuable)
// - Character composition (letters only > letters+numbers > hyphens)
// - Dictionary word detection
// - Numeric patterns (3-digit, 4-digit domains)
// - Domain age (older = more valuable)
// - Premium keyword detection
// ============================================================================

export interface AppraisalResult {
  domain: string
  estimatedValue: number       // USD
  estimatedValueCNY: number    // CNY (approx)
  confidence: 'low' | 'medium' | 'high'
  breakdown: AppraisalBreakdown
  factors: string[]            // Human-readable explanation of factors
  appraisedAt: string
}

interface AppraisalBreakdown {
  tldScore: number
  lengthScore: number
  compositionScore: number
  patternScore: number
  ageScore: number
  totalScore: number
}

// USD to CNY approximate rate
const USD_TO_CNY = 7.2

// ============================================================================
// TLD value tiers (base value multiplier and market data)
// ============================================================================
const TLD_VALUES: Record<string, { tier: number; baseValue: number }> = {
  // Tier 1 - Premium TLDs
  'com':   { tier: 1, baseValue: 1500 },
  'net':   { tier: 2, baseValue: 500 },
  'org':   { tier: 2, baseValue: 400 },
  'io':    { tier: 2, baseValue: 600 },
  'ai':    { tier: 1, baseValue: 2000 },
  'co':    { tier: 2, baseValue: 400 },
  'me':    { tier: 3, baseValue: 200 },
  'app':   { tier: 2, baseValue: 350 },
  'dev':   { tier: 2, baseValue: 350 },

  // Tier 2 - Country codes with international usage
  'de':    { tier: 2, baseValue: 300 },
  'uk':    { tier: 2, baseValue: 300 },
  'co.uk': { tier: 2, baseValue: 300 },
  'fr':    { tier: 3, baseValue: 200 },
  'it':    { tier: 3, baseValue: 200 },
  'nl':    { tier: 3, baseValue: 200 },
  'ca':    { tier: 3, baseValue: 200 },
  'au':    { tier: 3, baseValue: 150 },
  'jp':    { tier: 2, baseValue: 300 },
  'kr':    { tier: 3, baseValue: 150 },

  // Chinese TLDs
  'cn':       { tier: 2, baseValue: 300 },
  'com.cn':   { tier: 3, baseValue: 150 },
  'net.cn':   { tier: 4, baseValue: 80 },
  'org.cn':   { tier: 4, baseValue: 80 },

  // Tier 3 - New gTLDs (popular)
  'xyz':     { tier: 4, baseValue: 50 },
  'top':     { tier: 4, baseValue: 40 },
  'site':    { tier: 4, baseValue: 60 },
  'online':  { tier: 4, baseValue: 50 },
  'store':   { tier: 3, baseValue: 100 },
  'tech':    { tier: 3, baseValue: 120 },
  'club':    { tier: 4, baseValue: 50 },
  'vip':     { tier: 4, baseValue: 60 },
  'shop':    { tier: 3, baseValue: 100 },
  'cloud':   { tier: 3, baseValue: 120 },
  'live':    { tier: 4, baseValue: 60 },
  'blog':    { tier: 3, baseValue: 100 },
  'cc':      { tier: 3, baseValue: 100 },
  'tv':      { tier: 3, baseValue: 150 },
  'info':    { tier: 3, baseValue: 100 },
  'biz':     { tier: 4, baseValue: 60 },
  'mobi':    { tier: 4, baseValue: 50 },
  'pro':     { tier: 4, baseValue: 60 },
  'world':   { tier: 4, baseValue: 40 },
  'space':   { tier: 4, baseValue: 30 },
  'icu':     { tier: 5, baseValue: 20 },
  'cyou':    { tier: 5, baseValue: 15 },
}

// Common English dictionary words that add value
const PREMIUM_KEYWORDS = new Set([
  // Tech
  'cloud', 'data', 'code', 'tech', 'web', 'app', 'digital', 'smart', 'cyber', 'net',
  'ai', 'ml', 'api', 'bot', 'dev', 'ops', 'hub', 'lab', 'io', 'sys',
  // Business
  'pay', 'cash', 'bank', 'fund', 'trade', 'shop', 'store', 'buy', 'sell', 'deal',
  'biz', 'pro', 'work', 'job', 'hire', 'team', 'lead', 'grow', 'boost', 'max',
  // Generic high-value
  'go', 'get', 'top', 'best', 'fast', 'easy', 'free', 'new', 'hot', 'big',
  'one', 'all', 'my', 'the', 'now', 'win', 'ace', 'key', 'zen', 'vip',
  // Industry
  'health', 'care', 'life', 'fit', 'med', 'bio', 'eco', 'green', 'solar', 'power',
  'food', 'eat', 'chef', 'cook', 'game', 'play', 'fun', 'art', 'music', 'film',
  'travel', 'trip', 'tour', 'fly', 'car', 'auto', 'home', 'real', 'land', 'city',
  'news', 'media', 'book', 'read', 'learn', 'edu', 'school', 'crypto', 'coin', 'nft',
  // Chinese pinyin high-value
  'le', 'da', 'xin', 'jia', 'mei', 'bao', 'you', 'hao', 'wan', 'qian',
])

// ============================================================================
// Appraisal Engine
// ============================================================================

function extractSld(domain: string): string {
  const parts = domain.toLowerCase().split('.')
  return parts[0] || ''
}

function extractTld(domain: string): string {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return ''
  // Check multi-level TLDs first
  if (parts.length >= 3) {
    const twoLevel = parts.slice(-2).join('.')
    if (TLD_VALUES[twoLevel]) return twoLevel
  }
  return parts[parts.length - 1]
}

function getTldInfo(tld: string): { tier: number; baseValue: number } {
  return TLD_VALUES[tld] || { tier: 5, baseValue: 15 }
}

// Score domain length (1-100)
function scoreDomainLength(sld: string): number {
  const len = sld.length
  if (len === 1) return 100  // Single char: extremely rare & valuable
  if (len === 2) return 95   // 2-char: very valuable
  if (len === 3) return 88   // 3-char: highly valuable
  if (len === 4) return 75   // 4-char: valuable
  if (len === 5) return 60
  if (len === 6) return 48
  if (len === 7) return 38
  if (len === 8) return 30
  if (len <= 10) return 22
  if (len <= 12) return 15
  if (len <= 15) return 10
  if (len <= 20) return 5
  return 2
}

// Score character composition (1-100)
function scoreComposition(sld: string): number {
  const hasHyphen = sld.includes('-')
  const hasNumbers = /\d/.test(sld)
  const isAllLetters = /^[a-z]+$/.test(sld)
  const isAllNumbers = /^\d+$/.test(sld)

  if (isAllLetters) return 100
  if (isAllNumbers) {
    // Pure numeric domains have special value
    if (sld.length <= 3) return 90
    if (sld.length <= 4) return 75
    if (sld.length <= 5) return 50
    return 30
  }
  if (hasHyphen) return 20  // Hyphens significantly reduce value
  if (hasNumbers && !hasHyphen) return 50  // Mix of letters and numbers
  return 40
}

// Score patterns (premium patterns get bonus)
function scorePattern(sld: string): { score: number; factors: string[] } {
  let score = 50 // baseline
  const factors: string[] = []

  // Single character
  if (sld.length === 1) {
    score = 100
    factors.push('单字符域名，极为稀缺')
  }

  // 2-letter .com type (extremely valuable)
  if (sld.length === 2 && /^[a-z]+$/.test(sld)) {
    score = 98
    factors.push('双字母域名，稀缺资产')
  }

  // 3-letter pronounceable (LLL)
  if (sld.length === 3 && /^[a-z]+$/.test(sld)) {
    score = 88
    factors.push('三字母域名')
    // Check if it's a vowel-consonant pattern (more pronounceable)
    const vowels = 'aeiou'
    const hasVowel = [...sld].some(c => vowels.includes(c))
    if (hasVowel) {
      score = 92
      factors.push('含元音，易读易记')
    }
  }

  // 4-letter
  if (sld.length === 4 && /^[a-z]+$/.test(sld)) {
    score = 72
    factors.push('四字母域名')
  }

  // CVCV pattern (consonant-vowel, very pronounceable)
  if (/^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz][aeiou]$/i.test(sld)) {
    score = Math.max(score, 80)
    factors.push('CVCV 音节结构，易于发音')
  }

  // Pure numeric
  if (/^\d+$/.test(sld)) {
    if (sld.length === 1) { score = 85; factors.push('单数字域名') }
    else if (sld.length === 2) { score = 80; factors.push('双数字域名') }
    else if (sld.length === 3) { score = 75; factors.push('三数字域名') }
    else if (sld.length === 4) { score = 60; factors.push('四数字域名') }
    else if (sld.length === 5) { score = 40; factors.push('五数字域名') }

    // Lucky numbers (Chinese market)
    if (/^[0-9]*[6-9]+[0-9]*$/.test(sld) && !sld.includes('4')) {
      score += 5
      factors.push('含吉利数字')
    }
    // Repeating digits
    if (/^(\d)\1+$/.test(sld)) {
      score += 10
      factors.push('重复数字，高辨识度')
    }
    // Sequential
    if (/^(012|123|234|345|456|567|678|789|890)$/.test(sld) ||
        /^(098|987|876|765|654|543|432|321|210)$/.test(sld)) {
      score += 8
      factors.push('顺子数字')
    }
  }

  // Premium keyword match
  if (PREMIUM_KEYWORDS.has(sld)) {
    score = Math.max(score, 85)
    factors.push('高价值关键词')
  }

  // Check if SLD contains a premium keyword
  for (const kw of PREMIUM_KEYWORDS) {
    if (kw.length >= 3 && sld.includes(kw) && sld !== kw && sld.length <= kw.length + 4) {
      score = Math.max(score, 65)
      if (!factors.some(f => f.includes('关键词'))) {
        factors.push('包含高价值关键词')
      }
      break
    }
  }

  // Hyphen penalty
  if (sld.includes('-')) {
    score = Math.min(score, 30)
    factors.push('含连字符，降低价值')
  }

  // Double hyphen (IDN pattern like xn--)
  if (sld.includes('--')) {
    score = Math.min(score, 15)
    factors.push('含双连字符')
  }

  if (factors.length === 0) {
    if (sld.length <= 6) factors.push('短域名')
    else if (sld.length <= 10) factors.push('中等长度域名')
    else factors.push('长域名')
  }

  return { score, factors }
}

// Score domain age
function scoreAge(registrationDate: string | null): number {
  if (!registrationDate) return 30  // Unknown age
  const regDate = new Date(registrationDate)
  if (isNaN(regDate.getTime())) return 30
  const ageYears = (Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (ageYears >= 20) return 100
  if (ageYears >= 15) return 90
  if (ageYears >= 10) return 80
  if (ageYears >= 5) return 65
  if (ageYears >= 3) return 50
  if (ageYears >= 1) return 40
  return 30
}

// Calculate estimated value from scores
function calculateValue(
  tldInfo: { tier: number; baseValue: number },
  lengthScore: number,
  compositionScore: number,
  patternScore: number,
  ageScore: number,
): number {
  // Weighted scoring
  const totalScore = (
    lengthScore * 0.30 +
    compositionScore * 0.15 +
    patternScore * 0.35 +
    ageScore * 0.20
  )

  // Value curve: exponential growth for high scores
  const baseValue = tldInfo.baseValue

  let multiplier: number
  if (totalScore >= 95) multiplier = 200
  else if (totalScore >= 90) multiplier = 100
  else if (totalScore >= 85) multiplier = 50
  else if (totalScore >= 80) multiplier = 25
  else if (totalScore >= 70) multiplier = 10
  else if (totalScore >= 60) multiplier = 5
  else if (totalScore >= 50) multiplier = 2.5
  else if (totalScore >= 40) multiplier = 1.2
  else if (totalScore >= 30) multiplier = 0.6
  else multiplier = 0.3

  // Tier adjustment
  const tierMultiplier = [0, 1.0, 0.6, 0.35, 0.15, 0.05][tldInfo.tier] || 0.05

  const value = baseValue * multiplier * tierMultiplier

  // Floor and ceiling
  return Math.max(1, Math.round(value))
}

// ============================================================================
// Main appraisal function
// ============================================================================

export function appraiseDomain(
  domain: string,
  registrationDate?: string | null,
): AppraisalResult {
  const cleanDomain = domain.toLowerCase().trim()
  const sld = extractSld(cleanDomain)
  const tld = extractTld(cleanDomain)
  const tldInfo = getTldInfo(tld)

  const lengthScore = scoreDomainLength(sld)
  const compositionScore = scoreComposition(sld)
  const { score: patternScore, factors } = scorePattern(sld)
  const ageScore = scoreAge(registrationDate || null)

  const totalScore = Math.round(
    lengthScore * 0.30 +
    compositionScore * 0.15 +
    patternScore * 0.35 +
    ageScore * 0.20
  )

  const estimatedValue = calculateValue(tldInfo, lengthScore, compositionScore, patternScore, ageScore)
  const estimatedValueCNY = Math.round(estimatedValue * USD_TO_CNY)

  // TLD factor
  factors.unshift(`后缀 .${tld}（${['', '顶级', '优质', '普通', '一般', '低价'][tldInfo.tier]}后缀）`)

  // Age factor
  if (registrationDate) {
    const regDate = new Date(registrationDate)
    if (!isNaN(regDate.getTime())) {
      const ageYears = Math.floor((Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      if (ageYears >= 10) factors.push(`域龄 ${ageYears} 年，老域名溢价`)
      else if (ageYears >= 5) factors.push(`域龄 ${ageYears} 年`)
      else factors.push(`域龄 ${ageYears} 年，较新`)
    }
  }

  // Confidence based on how well we can assess
  let confidence: 'low' | 'medium' | 'high' = 'medium'
  if (tldInfo.tier <= 2 && sld.length <= 6) confidence = 'high'
  if (tldInfo.tier >= 4 || sld.length > 15) confidence = 'low'

  return {
    domain: cleanDomain,
    estimatedValue,
    estimatedValueCNY,
    confidence,
    breakdown: {
      tldScore: tldInfo.tier,
      lengthScore,
      compositionScore,
      patternScore,
      ageScore,
      totalScore,
    },
    factors,
    appraisedAt: new Date().toISOString(),
  }
}

// Batch appraisal
export function appraiseDomains(
  domains: { domain: string; registrationDate?: string | null }[],
): AppraisalResult[] {
  return domains.map(d => appraiseDomain(d.domain, d.registrationDate))
}
