import { useDatabase } from '~/server/database'

/**
 * Analyze domain name properties
 */
export function analyzeDomain(domainName: string): {
  sld: string; tld: string; length: number;
  hasNumbers: boolean; hasHyphens: boolean;
  isPureLetters: boolean; isPureNumbers: boolean;
} {
  const parts = domainName.split('.')
  const sld = parts[0]
  const tld = parts.slice(1).join('.')
  return {
    sld, tld: '.' + tld,
    length: sld.length,
    hasNumbers: /\d/.test(sld),
    hasHyphens: sld.includes('-'),
    isPureLetters: /^[a-z]+$/i.test(sld),
    isPureNumbers: /^\d+$/.test(sld),
  }
}

/**
 * Generate sample expiring domains for demo/testing.
 * In production, this would be replaced with real data feeds.
 *
 * For now, generate realistic-looking domains across various TLDs.
 */
export function generateSampleDropDomains(): {
  domain_name: string; tld: string; drop_date: string;
  status: string; source: string; estimated_value: number;
}[] {
  // Generate domains that look like they'd be dropping
  const tlds = ['.com', '.net', '.org', '.io', '.co', '.ai', '.xyz', '.top', '.cn', '.de', '.uk', '.app']
  const prefixes = [
    // 3-letter
    'abc', 'xyz', 'top', 'pro', 'dev', 'web', 'app', 'hub', 'lab', 'net',
    'sky', 'sun', 'fly', 'run', 'big', 'hot', 'new', 'one', 'max', 'ace',
    // 4-letter
    'tech', 'data', 'code', 'fast', 'easy', 'cool', 'best', 'mega', 'meta', 'next',
    'blue', 'gold', 'star', 'moon', 'fire', 'wind', 'wave', 'rock', 'sand', 'lake',
    // 5-letter
    'cloud', 'smart', 'green', 'power', 'super', 'cyber', 'royal', 'prime', 'elite', 'ultra',
    'magic', 'fresh', 'quick', 'swift', 'brave', 'noble', 'clear', 'dream', 'spark', 'flash',
    // numeric
    '888', '666', '520', '168', '1688', '8888', '6666',
    // mixed
    'ai2x', 'web3', 'go2', 'e-biz', 'my-app', 'top-1',
  ]

  const domains: any[] = []
  const now = new Date()

  for (const prefix of prefixes) {
    // Each prefix gets 1-2 random TLDs
    const numTlds = Math.floor(Math.random() * 2) + 1
    const shuffled = [...tlds].sort(() => Math.random() - 0.5)

    for (let i = 0; i < numTlds; i++) {
      const tld = shuffled[i]
      const domain = `${prefix}${tld}`
      const daysFromNow = Math.floor(Math.random() * 30) + 1
      const dropDate = new Date(now.getTime() + daysFromNow * 86400000).toISOString().split('T')[0]

      const analysis = analyzeDomain(domain)

      // Estimate value based on properties
      let value = 10
      if (analysis.length <= 3) value = 500
      else if (analysis.length <= 4) value = 100
      else if (analysis.length <= 5) value = 50

      if (tld === '.com') value *= 5
      else if (tld === '.ai') value *= 4
      else if (tld === '.io') value *= 3

      if (analysis.isPureLetters && analysis.length <= 4) value *= 2
      if (analysis.isPureNumbers && analysis.length <= 4) value *= 3

      domains.push({
        domain_name: domain,
        tld,
        drop_date: dropDate,
        status: daysFromNow <= 5 ? 'pending_delete' : 'expiring',
        source: 'system',
        estimated_value: Math.round(value),
      })
    }
  }

  return domains
}

/**
 * Import drop domains into the database (upsert)
 */
export function importDropDomains(domains: any[]): number {
  const db = useDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO drop_domains (domain_name, tld, drop_date, status, source, estimated_value, domain_length, has_numbers, has_hyphens, is_pure_letters, is_pure_numbers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let count = 0
  const insert = db.transaction((items: any[]) => {
    for (const d of items) {
      const analysis = analyzeDomain(d.domain_name)
      stmt.run(
        d.domain_name, d.tld || analysis.tld, d.drop_date || '',
        d.status || 'pending_delete', d.source || 'import',
        d.estimated_value || 0, analysis.length,
        analysis.hasNumbers ? 1 : 0, analysis.hasHyphens ? 1 : 0,
        analysis.isPureLetters ? 1 : 0, analysis.isPureNumbers ? 1 : 0
      )
      count++
    }
  })
  insert(domains)
  return count
}
