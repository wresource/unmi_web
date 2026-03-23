import { Socket } from 'net'

// ============================================================================
// Types
// ============================================================================

export interface WhoisResult {
  domain: string
  registered: boolean
  registrar: string
  registrationDate: string | null
  expiryDate: string | null
  updatedDate: string | null
  nameservers: string[]
  status: string[]
  dnssec: string
  registrantOrg: string
  registrantCountry: string
  whoisServer: string
  rawText: string
  source: 'rdap' | 'whois'
  queriedAt: string
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

const NETWORK_TIMEOUT = 10_000

/** WHOIS servers indexed by TLD (without leading dot) */
const WHOIS_SERVERS: Record<string, string> = {
  // Major gTLDs
  com: 'whois.verisign-grs.com',
  net: 'whois.verisign-grs.com',
  org: 'whois.pir.org',
  info: 'whois.afilias.net',
  biz: 'whois.biz',
  name: 'whois.nic.name',
  mobi: 'whois.dotmobiregistry.net',
  pro: 'whois.registrypro.pro',
  tel: 'whois.nic.tel',
  asia: 'whois.nic.asia',
  cat: 'whois.nic.cat',
  jobs: 'whois.nic.jobs',
  travel: 'whois.nic.travel',
  coop: 'whois.nic.coop',
  museum: 'whois.nic.museum',
  aero: 'whois.aero',
  xxx: 'whois.nic.xxx',
  post: 'whois.dotpostregistry.net',

  // New gTLDs (popular)
  io: 'whois.nic.io',
  co: 'whois.nic.co',
  me: 'whois.nic.me',
  tv: 'whois.nic.tv',
  cc: 'ccwhois.verisign-grs.com',
  app: 'whois.nic.google',
  dev: 'whois.nic.google',
  page: 'whois.nic.google',
  xyz: 'whois.nic.xyz',
  top: 'whois.nic.top',
  site: 'whois.nic.site',
  online: 'whois.nic.online',
  store: 'whois.nic.store',
  tech: 'whois.nic.tech',
  space: 'whois.nic.space',
  fun: 'whois.nic.fun',
  website: 'whois.nic.website',
  club: 'whois.nic.club',
  vip: 'whois.nic.vip',
  shop: 'whois.nic.shop',
  work: 'whois.nic.work',
  ltd: 'whois.nic.ltd',
  group: 'whois.nic.group',
  live: 'whois.nic.live',
  blog: 'whois.nic.blog',
  cloud: 'whois.nic.cloud',
  ink: 'whois.nic.ink',
  design: 'whois.nic.design',
  art: 'whois.nic.art',
  icu: 'whois.nic.icu',
  cyou: 'whois.nic.cyou',
  world: 'whois.nic.world',
  today: 'whois.nic.today',
  life: 'whois.nic.life',
  network: 'whois.nic.network',
  center: 'whois.nic.center',
  email: 'whois.nic.email',
  solutions: 'whois.nic.solutions',
  agency: 'whois.nic.agency',
  digital: 'whois.nic.digital',
  media: 'whois.nic.media',
  studio: 'whois.nic.studio',
  guru: 'whois.nic.guru',
  company: 'whois.nic.company',

  // ccTLDs
  cn: 'whois.cnnic.cn',
  hk: 'whois.hkirc.hk',
  tw: 'whois.twnic.net.tw',
  jp: 'whois.jprs.jp',
  kr: 'whois.kr',
  uk: 'whois.nic.uk',
  de: 'whois.denic.de',
  fr: 'whois.nic.fr',
  it: 'whois.nic.it',
  es: 'whois.nic.es',
  nl: 'whois.sidn.nl',
  be: 'whois.dns.be',
  at: 'whois.nic.at',
  ch: 'whois.nic.ch',
  se: 'whois.iis.se',
  no: 'whois.norid.no',
  dk: 'whois.dk-hostmaster.dk',
  fi: 'whois.fi',
  pl: 'whois.dns.pl',
  cz: 'whois.nic.cz',
  sk: 'whois.sk-nic.sk',
  hu: 'whois.nic.hu',
  ro: 'whois.rotld.ro',
  bg: 'whois.register.bg',
  ru: 'whois.tcinet.ru',
  ua: 'whois.ua',
  by: 'whois.cctld.by',
  su: 'whois.tcinet.ru',
  us: 'whois.nic.us',
  ca: 'whois.cira.ca',
  mx: 'whois.mx',
  br: 'whois.registro.br',
  ar: 'whois.nic.ar',
  cl: 'whois.nic.cl',
  in: 'whois.registry.in',
  sg: 'whois.sgnic.sg',
  my: 'whois.mynic.my',
  th: 'whois.thnic.co.th',
  vn: 'whois.vnnic.vn',
  id: 'whois.id',
  ph: 'whois.dot.ph',
  au: 'whois.auda.org.au',
  nz: 'whois.srs.net.nz',
  za: 'whois.registry.net.za',
  eg: 'whois.ripe.net',
  ng: 'whois.nic.net.ng',
  ke: 'whois.kenic.or.ke',
  ae: 'whois.aeda.net.ae',
  sa: 'whois.nic.net.sa',
  il: 'whois.isoc.org.il',
  tr: 'whois.nic.tr',
  ir: 'whois.nic.ir',
  pk: 'whois.pknic.net.pk',
}

/** TLDs that use "thin" WHOIS — the registry returns only the registrar's WHOIS server, requiring a second query */
const THIN_WHOIS_TLDS = new Set(['com', 'net', 'cc', 'tv'])

/** Patterns indicating a domain is NOT registered */
const NOT_FOUND_PATTERNS = [
  'no match for',
  'not found',
  'no entries found',
  'no data found',
  'nothing found',
  'status: free',
  'status: available',
  'domain not found',
  'no object found',
  'object does not exist',
  '% no such domain',
  'the queried object does not exist',
  'domain name not known',
  'is available for registration',
  'no match',
  'not registered',
  'is free',
  'status:             available',
  'above domain name is not registered',
]

// ============================================================================
// RDAP Bootstrap Cache
// ============================================================================

let rdapBootstrap: Map<string, string> | null = null
let rdapBootstrapLoadedAt = 0
const RDAP_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Load the RDAP bootstrap file from IANA. Maps each TLD to its RDAP base URL.
 * Results are cached in memory for 24 hours.
 */
async function loadRdapBootstrap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (rdapBootstrap && (now - rdapBootstrapLoadedAt) < RDAP_CACHE_TTL) {
    return rdapBootstrap
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT)

    const response = await fetch('https://data.iana.org/rdap/dns.json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`RDAP bootstrap fetch failed: HTTP ${response.status}`)
    }

    const data = await response.json() as { services: [string[], string[]][] }
    const map = new Map<string, string>()

    for (const [tlds, servers] of data.services) {
      // Prefer HTTPS server
      const server = servers.find(s => s.startsWith('https://')) || servers[0]
      if (!server) continue
      const normalizedServer = server.endsWith('/') ? server : server + '/'

      for (const tld of tlds) {
        map.set(tld.toLowerCase(), normalizedServer)
      }
    }

    rdapBootstrap = map
    rdapBootstrapLoadedAt = now
    return map
  } catch (err) {
    if (rdapBootstrap) return rdapBootstrap
    console.warn('[whois] Failed to load RDAP bootstrap:', (err as Error).message)
    return new Map()
  }
}

// ============================================================================
// RDAP Query
// ============================================================================

async function queryRdap(domain: string, tld: string): Promise<WhoisResult | null> {
  const bootstrap = await loadRdapBootstrap()
  const rdapServer = bootstrap.get(tld)
  if (!rdapServer) return null

  try {
    const url = `${rdapServer}domain/${domain}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json, application/json' },
    })
    clearTimeout(timer)

    if (response.status === 404) {
      return makeEmptyResult(domain, 'rdap', rdapServer, false)
    }

    if (!response.ok) {
      return null // Fall through to WHOIS
    }

    const data = await response.json() as any
    return parseRdapResponse(data, domain, rdapServer)
  } catch (err) {
    console.warn(`[whois] RDAP query failed for ${domain}:`, (err as Error).message)
    return null
  }
}

function parseRdapResponse(data: any, domain: string, rdapServer: string): WhoisResult {
  const result: WhoisResult = {
    domain,
    registered: true,
    registrar: '',
    registrationDate: null,
    expiryDate: null,
    updatedDate: null,
    nameservers: [],
    status: [],
    dnssec: '',
    registrantOrg: '',
    registrantCountry: '',
    whoisServer: rdapServer,
    rawText: JSON.stringify(data, null, 2),
    source: 'rdap',
    queriedAt: new Date().toISOString(),
  }

  // Events: registration, expiration, last changed
  if (Array.isArray(data.events)) {
    for (const event of data.events) {
      const action = (event.eventAction || '').toLowerCase()
      const date = event.eventDate || null
      if (action === 'registration' && date) {
        result.registrationDate = normalizeDate(date)
      } else if (action === 'expiration' && date) {
        result.expiryDate = normalizeDate(date)
      } else if (action === 'last changed' && date) {
        result.updatedDate = normalizeDate(date)
      }
    }
  }

  // Entities: registrar, registrant
  if (Array.isArray(data.entities)) {
    for (const entity of data.entities) {
      const roles: string[] = Array.isArray(entity.roles) ? entity.roles : []

      if (roles.includes('registrar')) {
        result.registrar = extractVcardField(entity.vcardArray, 'fn')
          || entity.handle
          || entity.publicIds?.[0]?.identifier
          || ''
      }

      if (roles.includes('registrant')) {
        result.registrantOrg = extractVcardField(entity.vcardArray, 'org')
          || extractVcardField(entity.vcardArray, 'fn')
        result.registrantCountry = extractVcardCountry(entity.vcardArray)
      }
    }
  }

  // Nameservers
  if (Array.isArray(data.nameservers)) {
    result.nameservers = data.nameservers
      .map((ns: any) => (ns.ldhName || ns.unicodeName || '').toLowerCase())
      .filter(Boolean)
  }

  // Status
  if (Array.isArray(data.status)) {
    result.status = data.status.map((s: string) => s.toLowerCase())
  }

  // DNSSEC
  if (data.secureDNS) {
    result.dnssec = data.secureDNS.delegationSigned ? 'signed' : 'unsigned'
  }

  // Port 43 WHOIS server override
  if (data.port43) {
    result.whoisServer = data.port43
  }

  return result
}

function extractVcardField(vcardArray: any, fieldName: string): string {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) return ''
  const entries = vcardArray[1]
  if (!Array.isArray(entries)) return ''
  for (const entry of entries) {
    if (Array.isArray(entry) && entry[0] === fieldName) {
      return String(entry[3] || '')
    }
  }
  return ''
}

function extractVcardCountry(vcardArray: any): string {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) return ''
  const entries = vcardArray[1]
  if (!Array.isArray(entries)) return ''
  for (const entry of entries) {
    if (Array.isArray(entry) && entry[0] === 'adr') {
      const adr = entry[3]
      if (Array.isArray(adr) && adr.length >= 7) {
        return String(adr[6] || '')
      }
    }
  }
  return ''
}

// ============================================================================
// Traditional WHOIS via raw TCP sockets
// ============================================================================

/**
 * Send a raw WHOIS query over TCP to the given server on port 43.
 * Handles encoding: tries UTF-8 first, falls back to latin1.
 */
function whoisTcpQuery(server: string, query: string, timeout = NETWORK_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const socket = new Socket()
    let settled = false

    const finish = (fn: typeof resolve | typeof reject, value: any) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      fn(value)
    }

    const timer = setTimeout(() => {
      finish(reject, new Error(`WHOIS query to ${server} timed out after ${timeout}ms`))
    }, timeout)

    socket.connect(43, server, () => {
      socket.write(query + '\r\n')
    })

    socket.on('data', (data: Buffer | string) => {
      chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data as string, 'utf8'))
    })

    socket.on('end', () => {
      const raw = Buffer.concat(chunks)
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
      } catch {
        text = new TextDecoder('latin1').decode(raw)
      }
      finish(resolve, text)
    })

    socket.on('error', (err: Error) => {
      finish(reject, new Error(`WHOIS query to ${server} failed: ${err.message}`))
    })
  })
}

function getWhoisServer(tld: string): string {
  return WHOIS_SERVERS[tld] || `whois.nic.${tld}`
}

/**
 * Build the query string for a given domain/TLD.
 * Some registries require special query formats.
 */
function buildWhoisQuery(domain: string, tld: string): string {
  switch (tld) {
    case 'de':
      return `-T dn,ace ${domain}`
    case 'jp':
      return `${domain}/e`
    default:
      return domain
  }
}

/**
 * Extract the registrar's referral WHOIS server from a thin WHOIS response.
 */
function extractReferralServer(text: string): string | null {
  const patterns = [
    /Registrar WHOIS Server:\s*(\S+)/i,
    /Whois Server:\s*(\S+)/i,
    /ReferralServer:\s*(?:whois:\/\/|rwhois:\/\/)?(\S+)/i,
    /refer:\s*(\S+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const server = match[1].trim().replace(/\.$/, '')
      if (server.includes('.') && !server.includes('/')) {
        return server
      }
    }
  }
  return null
}

async function queryWhois(domain: string, tld: string): Promise<WhoisResult> {
  const server = getWhoisServer(tld)
  const query = buildWhoisQuery(domain, tld)

  let rawText: string
  try {
    rawText = await whoisTcpQuery(server, query)
  } catch (err) {
    return {
      ...makeEmptyResult(domain, 'whois', server, false),
      error: (err as Error).message,
    }
  }

  // Check if domain is not registered
  const lowerText = rawText.toLowerCase()
  const isNotFound = NOT_FOUND_PATTERNS.some(p => lowerText.includes(p))
  if (isNotFound) {
    return makeEmptyResult(domain, 'whois', server, false, rawText)
  }

  // For thin WHOIS TLDs, do a second query to the registrar's WHOIS server for full details
  let fullText = rawText
  if (THIN_WHOIS_TLDS.has(tld)) {
    const referralServer = extractReferralServer(rawText)
    if (referralServer && referralServer.toLowerCase() !== server.toLowerCase()) {
      try {
        const secondResponse = await whoisTcpQuery(referralServer, domain)
        fullText = rawText + '\n\n' + secondResponse
      } catch {
        // Continue with thin result if second query fails
      }
    }
  }

  const parsed = parseWhoisText(fullText, domain, tld)

  return {
    domain,
    registered: true,
    registrar: parsed.registrar || '',
    registrationDate: parsed.registrationDate || null,
    expiryDate: parsed.expiryDate || null,
    updatedDate: parsed.updatedDate || null,
    nameservers: parsed.nameservers || [],
    status: parsed.status || [],
    dnssec: parsed.dnssec || '',
    registrantOrg: parsed.registrantOrg || '',
    registrantCountry: parsed.registrantCountry || '',
    whoisServer: server,
    rawText: fullText,
    source: 'whois',
    queriedAt: new Date().toISOString(),
  }
}

// ============================================================================
// WHOIS Text Parsers
// ============================================================================

/**
 * Dispatch to a TLD-specific parser, then fill gaps with the generic parser.
 */
function parseWhoisText(text: string, domain: string, tld: string): Partial<WhoisResult> {
  let result: Partial<WhoisResult>

  switch (tld) {
    case 'jp':
      result = parseWhoisJp(text, domain)
      break
    case 'de':
      result = parseWhoisDe(text, domain)
      break
    case 'br':
      result = parseWhoisBr(text, domain)
      break
    case 'uk':
      result = parseWhoisUk(text, domain)
      break
    case 'fr':
      result = parseWhoisFr(text, domain)
      break
    case 'cn':
      result = parseWhoisCn(text, domain)
      break
    default:
      result = parseWhoisGeneric(text)
      break
  }

  // Ensure arrays exist
  if (!result.nameservers) result.nameservers = []
  if (!result.status) result.status = []

  return result
}

// ---- Generic parser (covers most registries) ----

function parseWhoisGeneric(text: string): Partial<WhoisResult> {
  const result: Partial<WhoisResult> = {
    nameservers: [],
    status: [],
  }

  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('%') || trimmed.startsWith('#') || trimmed.startsWith('>')) {
      continue
    }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const rawKey = trimmed.substring(0, colonIdx).trim()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    const key = normalizeKey(rawKey)

    // Registration date
    if (matchesKey(key, [
      'creation date', 'created date', 'created', 'registration date',
      'domain registration date', 'registered', 'registration time',
      'create date', 'created on', 'domain name commencement date',
      'registered on',
    ])) {
      if (!result.registrationDate) result.registrationDate = normalizeDate(value)
    }

    // Expiry date
    else if (matchesKey(key, [
      'expiry date', 'expiration date', 'registry expiry date',
      'registrar registration expiration date', 'paid-till', 'renewal date',
      'expires', 'expires on', 'expiration time', 'expire date',
      'domain expiration date',
    ])) {
      if (!result.expiryDate) result.expiryDate = normalizeDate(value)
    }

    // Updated date
    else if (matchesKey(key, [
      'updated date', 'last updated', 'last modified', 'changed',
      'last update', 'modified', 'update date',
    ])) {
      if (!result.updatedDate) result.updatedDate = normalizeDate(value)
    }

    // Registrar
    else if (matchesKey(key, [
      'registrar', 'sponsoring registrar', 'registrar name', 'registrar_name',
    ])) {
      if (!result.registrar) result.registrar = value
    }

    // Name servers
    else if (matchesKey(key, [
      'name server', 'nameserver', 'nserver', 'ns', 'name servers',
      'hostname', 'dns',
    ])) {
      const ns = value.split(/\s+/)[0].toLowerCase().replace(/\.$/, '')
      if (ns && ns.includes('.') && !result.nameservers!.includes(ns)) {
        result.nameservers!.push(ns)
      }
    }

    // Status
    else if (matchesKey(key, ['domain status', 'status', 'state'])) {
      const statusValue = value.split(/\s+/)[0].toLowerCase()
      if (statusValue && !result.status!.includes(statusValue)) {
        result.status!.push(statusValue)
      }
    }

    // DNSSEC
    else if (matchesKey(key, ['dnssec', 'dnssec ds-record'])) {
      if (!result.dnssec) result.dnssec = value.toLowerCase()
    }

    // Registrant Organization
    else if (matchesKey(key, [
      'registrant organization', 'registrant org', 'registrant name',
    ])) {
      if (!result.registrantOrg) result.registrantOrg = value
    }

    // Registrant Country
    else if (matchesKey(key, [
      'registrant country', 'registrant country/economy',
      'registrant contact country',
    ])) {
      if (!result.registrantCountry) result.registrantCountry = value
    }
  }

  return result
}

// ---- JP (JPRS) ----

function parseWhoisJp(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()

    // JPRS bracket format: "[Field Name]   value"
    const bracketMatch = trimmed.match(/^\[(.+?)\]\s+(.+)$/)
    if (!bracketMatch) continue

    const key = bracketMatch[1].toLowerCase()
    const value = bracketMatch[2].trim()

    if ((key === 'created on' || key === 'registered date') && !result.registrationDate) {
      result.registrationDate = normalizeDate(value)
    } else if ((key === 'expires on' || key === 'expiration date') && !result.expiryDate) {
      result.expiryDate = normalizeDate(value)
    } else if ((key === 'last updated' || key === 'last update') && !result.updatedDate) {
      result.updatedDate = normalizeDate(value)
    } else if (key === 'name server') {
      const ns = value.split(/\s+/)[0].toLowerCase().replace(/\.$/, '')
      if (ns && ns.includes('.')) {
        if (!result.nameservers) result.nameservers = []
        if (!result.nameservers.includes(ns)) result.nameservers.push(ns)
      }
    } else if (key === 'status') {
      if (!result.status) result.status = []
      const s = value.toLowerCase()
      if (!result.status.includes(s)) result.status.push(s)
    } else if ((key === 'organization' || key === 'registrant') && !result.registrantOrg) {
      result.registrantOrg = value
    }
  }

  return result
}

// ---- DE (DENIC) ----

function parseWhoisDe(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    if (key === 'changed' && !result.updatedDate) {
      result.updatedDate = normalizeDate(value)
    } else if (key === 'nserver') {
      const ns = value.split(/\s+/)[0].toLowerCase().replace(/\.$/, '')
      if (ns && ns.includes('.')) {
        if (!result.nameservers) result.nameservers = []
        if (!result.nameservers.includes(ns)) result.nameservers.push(ns)
      }
    } else if (key === 'organisation' && !result.registrantOrg) {
      result.registrantOrg = value
    }
  }

  // DENIC does not return creation/expiry dates via WHOIS
  return result
}

// ---- BR (registro.br) ----

function parseWhoisBr(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    if (key === 'created' && !result.registrationDate) {
      result.registrationDate = normalizeDate(value)
    } else if (key === 'expires' && !result.expiryDate) {
      result.expiryDate = normalizeDate(value)
    } else if (key === 'changed' && !result.updatedDate) {
      result.updatedDate = normalizeDate(value)
    } else if (key === 'owner' && !result.registrantOrg) {
      result.registrantOrg = value
    } else if (key === 'country' && !result.registrantCountry) {
      result.registrantCountry = value
    }
  }

  return result
}

// ---- UK (Nominet) ----

function parseWhoisUk(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    if (key === 'registered on' && !result.registrationDate) {
      result.registrationDate = normalizeDate(value)
    } else if (key === 'expiry date' && !result.expiryDate) {
      result.expiryDate = normalizeDate(value)
    } else if (key === 'last updated' && !result.updatedDate) {
      result.updatedDate = normalizeDate(value)
    } else if (key === 'registrant' && !result.registrantOrg) {
      result.registrantOrg = value
    }
  }

  return result
}

// ---- FR (AFNIC) ----

function parseWhoisFr(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    if (key === 'created' && !result.registrationDate) {
      result.registrationDate = normalizeDate(value)
    } else if (key === 'last-update' && !result.updatedDate) {
      result.updatedDate = normalizeDate(value)
    } else if (key === 'registrar' && !result.registrar) {
      result.registrar = value
    } else if (key === 'contact' && !result.registrantOrg) {
      result.registrantOrg = value
    } else if (key === 'country' && !result.registrantCountry) {
      result.registrantCountry = value
    }
  }

  return result
}

// ---- CN (CNNIC) ----

function parseWhoisCn(text: string, domain: string): Partial<WhoisResult> {
  const result = parseWhoisGeneric(text)

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!value) continue

    if ((key === 'registration time' || key === 'registration date') && !result.registrationDate) {
      result.registrationDate = normalizeDate(value)
    } else if ((key === 'expiration time' || key === 'expiration date') && !result.expiryDate) {
      result.expiryDate = normalizeDate(value)
    } else if (key === 'sponsoring registrar' && !result.registrar) {
      result.registrar = value
    } else if (key === 'registrant' && !result.registrantOrg) {
      result.registrantOrg = value
    }
  }

  return result
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize a WHOIS field key for comparison: lowercase and collapse whitespace/dashes/underscores.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\-\s]+/g, ' ').trim()
}

/**
 * Check if a normalized key matches any of the given patterns.
 */
function matchesKey(normalizedKey: string, patterns: string[]): boolean {
  return patterns.some(p => normalizedKey === p)
}

/**
 * Normalize a date string from any common WHOIS format into ISO 8601.
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null
  const cleaned = dateStr.trim()

  // Already ISO: 2024-01-15T12:00:00Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(cleaned)) {
    const d = new Date(cleaned)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned + 'T00:00:00Z')
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned.replace(/\//g, '-') + 'T00:00:00Z')
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(cleaned)) {
    const iso = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00Z`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // DD-Mon-YYYY or DD/Mon/YYYY (e.g. 15-Jan-2024)
  const dmy1 = cleaned.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{4})$/)
  if (dmy1) {
    const d = new Date(`${dmy1[2]} ${dmy1[1]}, ${dmy1[3]} UTC`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Mon DD YYYY or Month DD, YYYY
  const mdy = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (mdy) {
    const d = new Date(`${mdy[1]} ${mdy[2]}, ${mdy[3]} UTC`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // DD.MM.YYYY (European)
  const dotDmy = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotDmy) {
    const iso = `${dotDmy[3]}-${dotDmy[2].padStart(2, '0')}-${dotDmy[1].padStart(2, '0')}T00:00:00Z`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // DD/MM/YYYY
  const slashDmy = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashDmy) {
    const d = new Date(`${slashDmy[3]}-${slashDmy[2]}-${slashDmy[1]}T00:00:00Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYY.MM.DD
  const dotYmd = cleaned.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  if (dotYmd) {
    const d = new Date(`${dotYmd[1]}-${dotYmd[2]}-${dotYmd[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYY-MM-DD HH:MM:SS (with optional timezone)
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(cleaned)) {
    const normalized = cleaned.replace(/\s+/, 'T')
    const withTz = /Z|[+-]\d{2}/.test(normalized) ? normalized : normalized + 'Z'
    const d = new Date(withTz)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Last resort: let the JS parser try
  const d = new Date(cleaned)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function makeEmptyResult(
  domain: string,
  source: 'rdap' | 'whois',
  server: string,
  registered: boolean,
  rawText = '',
): WhoisResult {
  return {
    domain,
    registered,
    registrar: '',
    registrationDate: null,
    expiryDate: null,
    updatedDate: null,
    nameservers: [],
    status: [],
    dnssec: '',
    registrantOrg: '',
    registrantCountry: '',
    whoisServer: server,
    rawText,
    source,
    queriedAt: new Date().toISOString(),
  }
}

/**
 * Extract the effective TLD from a domain name.
 * Handles two-level ccTLDs like .co.uk, .com.au, etc.
 */
function extractTld(domain: string): string {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return ''

  // Check for known two-level ccTLD patterns (co.uk, com.au, com.br, co.jp, etc.)
  if (parts.length >= 3) {
    const twoLevel = parts.slice(-2).join('.')
    const secondLevel = parts[parts.length - 2]
    const twoLevelPrefixes = ['co', 'com', 'net', 'org', 'ac', 'gov', 'edu', 'mil', 'gen', 'idv']

    if (twoLevelPrefixes.includes(secondLevel) && WHOIS_SERVERS[twoLevel]) {
      return twoLevel
    }
  }

  return parts[parts.length - 1]
}

// ============================================================================
// Main Exported Function
// ============================================================================

/**
 * Perform a comprehensive domain WHOIS/RDAP lookup.
 *
 * Strategy:
 * 1. Try RDAP first (ICANN's modern JSON protocol) — structured and reliable.
 * 2. Fall back to traditional WHOIS over TCP port 43.
 * 3. Parse and normalize all results into a unified WhoisResult format.
 *
 * @param domain - The domain name to look up (e.g., "example.com")
 * @returns A normalized WhoisResult with registration data
 */
export async function lookupDomain(domain: string): Promise<WhoisResult> {
  const normalizedDomain = domain.toLowerCase().trim().replace(/\.$/, '')

  if (!normalizedDomain || !normalizedDomain.includes('.')) {
    return {
      ...makeEmptyResult(normalizedDomain || domain, 'whois', '', false),
      error: 'Invalid domain name',
    }
  }

  const tld = extractTld(normalizedDomain)
  if (!tld) {
    return {
      ...makeEmptyResult(normalizedDomain, 'whois', '', false),
      error: 'Could not determine TLD',
    }
  }

  // 1. Try RDAP
  try {
    const rdapResult = await queryRdap(normalizedDomain, tld)
    if (rdapResult) return rdapResult
  } catch (err) {
    console.warn(`[whois] RDAP failed for ${normalizedDomain}, falling back to WHOIS:`, (err as Error).message)
  }

  // 2. Fall back to traditional WHOIS
  try {
    return await queryWhois(normalizedDomain, tld)
  } catch (err) {
    return {
      ...makeEmptyResult(normalizedDomain, 'whois', getWhoisServer(tld), false),
      error: `WHOIS query failed: ${(err as Error).message}`,
    }
  }
}
