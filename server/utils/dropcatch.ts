import { useDatabase } from '~/server/database'

// ============================================================================
// RDAP Bootstrap (mirrors whois.ts logic but exported for dropcatch use)
// ============================================================================

let rdapBootstrapCache: Map<string, string> | null = null
let rdapBootstrapCacheTime = 0
const RDAP_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const RDAP_REQUEST_TIMEOUT = 5_000 // 5s for dropcatch (shorter than whois)
const RDAP_REQUEST_DELAY = 100 // 100ms between batches

async function loadRdapBootstrap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (rdapBootstrapCache && (now - rdapBootstrapCacheTime) < RDAP_CACHE_TTL) {
    return rdapBootstrapCache
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RDAP_REQUEST_TIMEOUT)

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
      const server = servers.find(s => s.startsWith('https://')) || servers[0]
      if (!server) continue
      const normalizedServer = server.endsWith('/') ? server : server + '/'
      for (const tld of tlds) {
        map.set(tld.toLowerCase(), normalizedServer)
      }
    }

    rdapBootstrapCache = map
    rdapBootstrapCacheTime = now
    return map
  } catch (err) {
    if (rdapBootstrapCache) return rdapBootstrapCache
    console.warn('[dropcatch] Failed to load RDAP bootstrap:', (err as Error).message)
    return new Map()
  }
}

// ============================================================================
// Domain Analysis
// ============================================================================

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

// ============================================================================
// RDAP Domain Availability Check
// ============================================================================

interface RdapCheckResult {
  available: boolean
  status: 'available' | 'pending_delete' | 'expired' | 'expiring' | 'registered'
  expiryDate?: string
  registrar?: string
}

/**
 * Check a single domain's availability/status via RDAP.
 * Returns null if the request fails (network error, unsupported TLD, etc.)
 */
async function checkDomainViaRdap(domain: string): Promise<RdapCheckResult | null> {
  const parts = domain.toLowerCase().split('.')
  if (parts.length < 2) return null

  const tld = parts.slice(1).join('.')
  const bootstrap = await loadRdapBootstrap()

  // Try exact TLD match, then top-level only
  let rdapServer = bootstrap.get(tld)
  if (!rdapServer && parts.length > 2) {
    rdapServer = bootstrap.get(parts[parts.length - 1])
  }
  if (!rdapServer) return null

  try {
    const url = `${rdapServer}domain/${domain}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RDAP_REQUEST_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json, application/json' },
    })
    clearTimeout(timer)

    // 404 = domain not found = available/dropped
    if (response.status === 404) {
      return { available: true, status: 'available' }
    }

    // Non-OK response = skip this domain
    if (!response.ok) return null

    const data = await response.json() as any

    // Extract status array
    const statusArr: string[] = Array.isArray(data.status) ? data.status : []
    const statusLower = statusArr.map((s: string) => s.toLowerCase())

    // Extract expiry date from events
    let expiryDate: string | undefined
    if (Array.isArray(data.events)) {
      for (const evt of data.events) {
        if (evt.eventAction === 'expiration' && evt.eventDate) {
          expiryDate = evt.eventDate
        }
      }
    }

    // Extract registrar
    let registrar = ''
    if (Array.isArray(data.entities)) {
      for (const entity of data.entities) {
        if (Array.isArray(entity.roles) && entity.roles.includes('registrar')) {
          if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
            for (const field of entity.vcardArray[1]) {
              if (field[0] === 'fn') {
                registrar = field[3] || ''
                break
              }
            }
          }
          if (!registrar && entity.handle) {
            registrar = entity.handle
          }
        }
      }
    }

    // Check for pending delete statuses
    const pendingDeleteStatuses = ['pendingdelete', 'pending delete', 'redemptionperiod', 'redemption period']
    const isPendingDelete = statusLower.some(s => pendingDeleteStatuses.some(pd => s.includes(pd)))
    if (isPendingDelete) {
      return {
        available: false,
        status: 'pending_delete',
        expiryDate,
        registrar,
      }
    }

    // Check if expired (expiry date in the past)
    if (expiryDate) {
      const expiry = new Date(expiryDate)
      if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        return {
          available: false,
          status: 'expired',
          expiryDate,
          registrar,
        }
      }
    }

    // Check if expiring soon (within 90 days) -- collect for monitoring, UI filters further
    if (expiryDate) {
      const expiry = new Date(expiryDate)
      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (86400000))
      if (daysLeft > 0 && daysLeft <= 90) {
        return {
          available: false,
          status: 'expiring',
          expiryDate,
          registrar,
        }
      }
    }

    // Domain is registered and active
    return {
      available: false,
      status: 'registered',
      expiryDate,
      registrar,
    }
  } catch (err) {
    console.warn(`[dropcatch] RDAP check failed for ${domain}:`, (err as Error).message)
    return null
  }
}

// ============================================================================
// Candidate Domain Generation — Pure Letter Domains Only
// ============================================================================

/**
 * Generate pure-letter domain candidates for scanning.
 * - All 2-letter combos (676)
 * - All 3-letter CVC patterns (2100)
 * - 4-letter common English words (~500)
 * - 5-letter common English words (~400)
 */
function generateLetterCandidates(): string[] {
  const candidates: string[] = []

  // All 2-letter combinations (676 total)
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      candidates.push(String.fromCharCode(97 + i, 97 + j))
    }
  }

  // All 3-letter CVC combinations (~2100)
  const vowels = 'aeiou'
  const consonants = 'bcdfghjklmnpqrstvwxyz'
  for (const c1 of consonants) {
    for (const v of vowels) {
      for (const c2 of consonants) {
        candidates.push(c1 + v + c2)
      }
    }
  }

  // 4-letter common words (expanded list ~500)
  const words4 = [
    'able','acid','aged','also','area','army','away','baby','back','ball',
    'band','bank','base','bath','bean','bear','beat','been','beer','bell',
    'belt','bend','best','bill','bind','bird','bite','blow','blue','boat',
    'body','bold','bomb','bond','bone','book','boot','born','boss','both',
    'bowl','burn','busy','cafe','cage','cake','call','calm','came','camp',
    'card','care','cart','case','cash','cast','cell','chat','chip','city',
    'clan','clay','clip','club','clue','coal','coat','code','coin',
    'cold','cole','come','cook','cool','copy','cord','core','corn','cost',
    'crew','crop','cube','cult','cure','cute','damn','dare','dark','data',
    'date','dawn','dead','deal','dear','debt','deck','deep','deer','demo',
    'deny','desk','dial','dice','diet','dirt','disc','dish','dock','does',
    'dome','done','door','dose','down','draw','drew','drop','drug','drum',
    'dual','dumb','dump','dust','duty','each','earn','ease','east','easy',
    'echo','edge','edit','else','emit','envy','epic','euro','even','ever',
    'evil','exam','exec','exit','expo','eyes','face','fact','fade','fail',
    'fair','fake','fall','fame','fans','fare','farm','fast','fate','fear',
    'feat','feed','feel','feet','fell','felt','file','fill','film','find',
    'fine','fire','firm','fish','fist','flag','flat','fled','flew','flex',
    'flip','flow','flux','foam','fold','folk','fond','font','food','fool',
    'foot','ford','fore','fork','form','fort','foul','four','free','from',
    'fuel','full','fund','fury','fuse','gain','game','gang','gate','gave',
    'gear','gene','gift','girl','give','glad','glow','glue','goat','goes',
    'gold','golf','gone','good','grab','gray','grew','grey','grid','grin',
    'grip','grow','gulf','guru','gust','hack','half','hall','halt','hand',
    'hang','hard','harm','hate','haul','have','hawk','haze','head','heal',
    'heap','hear','heat','heel','held','hell','help','herb','here','hero',
    'hide','high','hike','hill','hint','hire','hold','hole','holy','home',
    'hood','hook','hope','horn','host','hour','huge','hung','hunt','hurt',
    'idea','inch','info','iron','isle','item','jack','jade','jail','jazz',
    'jean','jets','jobs','join','joke','jump','june','jury','just','keen',
    'keep','kent','kept','kick','kids','kill','kind','king','kiss','kite',
    'knee','knew','knit','knob','knot','know','labs','lack','laid','lake',
    'lamp','land','lane','last','late','lawn','lead','leaf','lean','leap',
    'left','lend','lens','less','lied','life','lift','like','lime','limp',
    'line','link','lion','lips','list','live','load','loan','lock','logo',
    'long','look','lord','lose','loss','lost','lots','loud','love','luck',
    'lump','lung','lure','lush','made','mail','main','make','male','mall',
    'many','maps','mare','mark','mars','mask','mass','mate','math','maze',
    'meal','mean','meat','meet','mega','melt','memo','menu','mere','mesh',
    'mess','meta','mild','mile','milk','mill','mind','mine','mint','miss',
    'mode','mold','monk','mood','moon','more','moss','most','moth','move',
    'much','must','myth','nail','name','navy','near','neat','neck','need',
    'nest','nets','next','nice','nine','node','none','noon','norm','nose',
    'note','noun','nova','nude','nuts','odds','okay','omit','once','only',
    'onto','open','opts','oral','ours','oust','oval','oven','over','pace',
    'pack','page','paid','pain','pair','pale','palm','pane','para','park',
    'part','pass','past','path','peak','peel','peer','pile','pine','pink',
    'pipe','plan','play','plea','plot','plow','plug','plus','poem','poet',
    'pole','poll','polo','pond','pool','poor','pope','pork','port','pose',
    'post','pour','pray','prey','prof','prop','pros','pull','pump','punk',
    'pure','push','puts','quit','quiz','race','rack','rage','raid','rail',
    'rain','rank','rare','rate','rays','read','real','rear','reed','reef',
    'rein','rely','rent','rest','rice','rich','ride','ring','riot','rise',
    'risk','road','rock','rode','role','roll','roof','room','root','rope',
    'rose','rows','ruby','rude','ruin','rule','rush','rust','ruth','safe',
    'sage','said','sail','sake','sale','salt','same','sand','sang','save',
    'seal','seas','seat','sect','seed','seek','seem','seen','self','sell',
    'send','sent','sept','sets','shed','shin','ship','shop','shot','show',
    'shut','sick','side','sigh','sign','silk','sing','sink','site','size',
    'slam','slap','slim','slip','slot','slow','snap','snow','soak','soap',
    'soar','sock','sofa','soft','soil','sold','sole','solo','some','song',
    'soon','sort','soul','span','spin','spot','star','stay','stem','step',
    'stir','stop','such','suit','sung','sure','surf','swan','swap','swim',
    'tabs','tack','tail','take','tale','talk','tall','tank','tape','task',
    'taxi','teak','team','tear','tech','tell','temp','tend','tent','term',
    'test','text','than','them','then','they','thin','this','thus','tick',
    'tide','tidy','tied','tier','tile','till','tilt','time','tiny','tips',
    'tire','toad','told','toll','tomb','tone','took','tool','tops','torn',
    'toss','tour','town','trap','tray','tree','trim','trio','trip','trot',
    'true','tube','tuck','tuna','tune','turf','turn','twin','type','ugly',
    'undo','unit','unto','upon','urge','used','user','uses','vain','vale',
    'vary','vast','vein','verb','very','vest','veto','vice','view','vine',
    'visa','void','volt','vote','wade','wage','wait','wake','walk','wall',
    'wand','want','ward','warm','warn','warp','wars','wash','wave','wavy',
    'waxy','ways','weak','wear','weed','week','well','went','were','west',
    'what','when','whom','wide','wife','wild','will','wind','wine','wing',
    'wire','wise','wish','with','woke','wolf','wood','wool','word','wore',
    'work','worm','worn','wrap','yard','yarn','yeah','year','yoga','zero',
    'zinc','zone','zoom',
  ]
  candidates.push(...words4)

  // 5-letter common words (~400)
  const words5 = [
    'about','above','abuse','acted','added','admin','admit','adopt','adult',
    'after','again','agent','agree','ahead','aimed','alarm','album','alert',
    'alien','align','alike','alive','allow','alone','along','alter','among',
    'angel','anger','angle','angry','anime','ankle','annex','apart','apple',
    'apply','arena','argue','arise','armed','armor','array','arrow','aside',
    'asset','atlas','audio','audit','avoid','aware','awful','badge','badly',
    'baker','bases','basic','basin','basis','batch','beach','begun','being',
    'below','bench','billy','birth','black','blade','blame','blank','blast',
    'blaze','bleed','blend','bless','blind','block','blood','blown','board',
    'bonus','boost','booth','bound','brain','brand','brave','bread','break',
    'breed','brick','bride','brief','bring','broad','broke','brook','brown',
    'brush','build','built','bunch','burst','buyer','cable','candy','cargo',
    'carry','catch','cause','cease','chain','chair','chaos','charm','chart',
    'chase','cheap','check','cheek','chess','chest','chief','child','china',
    'choir','chose','chunk','civil','claim','clash','class','clean','clear',
    'clerk','click','cliff','climb','cling','clock','clone','close','cloud',
    'coach','coast','color','comic','coral','corps','costa','couch','could',
    'count','court','cover','crack','craft','crane','crash','crazy','cream',
    'crest','crime','crisp','cross','crowd','crown','crude','crush','cubic',
    'curve','cycle','daily','dance','datum','debug','decay','decor','delay',
    'delta','dense','depot','depth','derby','devil','dirty','donor','doubt',
    'draft','drain','drama','drank','drawn','dream','dress','dried','drift',
    'drill','drink','drive','drove','dying','eager','eagle','early','earth',
    'eight','elect','elite','email','embed','empty','ended','enemy','enjoy',
    'enter','entry','equal','equip','error','essay','event','every','exact',
    'exile','exist','extra','faced','fairy','faith','false','fancy',
    'fault','feast','fiber','field','fifth','fifty','fight','final','first',
    'fixed','flame','flash','fleet','flesh','flies','float','flood','floor',
    'flour','fluid','flush','focal','focus','force','forge','forth','forum',
    'found','frame','frank','fraud','fresh','front','fruit','fully','funds',
    'funny','gamma','genre','ghost','giant','given','glass','globe','glory',
    'going','grace','grade','grain','grand','grant','graph','grasp','grass',
    'grave','great','green','greet','grief','grill','grind','gross','group',
    'grove','grown','guard','guess','guest','guide','guild','guilt','guise',
    'happy','harsh','haven','heart','heavy','hence','herbs','hobby','holds',
    'honey','honor','hoped','horse','hotel','house','human','humor','hurry',
    'ideal','image','imply','inbox','index','indie','inner','input',
    'intel','inter','intro','irish','issue','ivory','japan','jewel','jimmy',
    'jones','judge','juice','knack','knife','knock','known','label','labor',
    'laden','lance','large','laser','later','laugh','layer','leads','learn',
    'lease','least','leave','legal','level','lever','light','liked','limit',
    'liner','links','linux','lists','liver','lobby','local','logic','login',
    'looks','loose','lotus','lover','lower','loyal','lucky','lunch','lunar',
    'lying','magic','magna','major','maker','manor','maple','march','marry',
    'match','maybe','mayor','meals','means','media','mercy','merge','merit',
    'metal','meter','micro','might','minor','minus','mixed','model','money',
    'month','moral','motor','mount','mouse','mouth','moved','movie','music',
    'named','naval','nerve','never','newly','night','noble','noise','north',
    'noted','novel','nurse','nylon','occur','ocean','offer','often','onset',
    'opera','orbit','order','organ','other','ought','outer','owned','owner',
    'oxide','ozone','paint','panel','panic','paper','party','pasta','patch',
    'pause','peace','pearl','penny','phase','phone','photo','piano','picks',
    'piece','pilot','pitch','pixel','pizza','place','plain','plane','plant',
    'plate','plaza','plead','pluck','plumb','point','polar','pound','power',
    'press','price','pride','prime','print','prior','prize','probe','proof',
    'prose','proud','prove','psalm','pulse','punch','pupil','queen','query',
    'quest','queue','quick','quiet','quite','quota','quote','radar','radio',
    'raise','rally','ranch','range','rapid','rated','ratio','reach','react',
    'realm','rebel','refer','reign','relax','relay','renew','reply','reset',
    'rider','ridge','rifle','right','rigid','rings','risen','risks','river',
    'robin','robot','rocky','roman','rouge','rough','round','route','royal',
    'rugby','ruled','ruler','rural','sadly','saint','salad','salon','sauce',
    'saved','scale','scare','scene','scope','score','scout','screw','seize',
    'sense','serve','setup','seven','shade','shaft','shake','shall','shame',
    'shape','share','shark','sharp','sheer','sheet','shelf','shell','shift',
    'shine','shirt','shock','shoot','shore','short','shown','siege','sight',
    'sigma','since','sixth','sixty','sized','skill','skull','slate','sleep',
    'slice','slide','slope','small','smart','smell','smile','smoke','snake',
    'solar','solid','solve','sonic','sorry','south','space','spare','spark',
    'speak','speed','spend','spent','spice','spike','spine','spoke','sport',
    'spray','squad','stack','staff','stage','stain','stake','stall','stamp',
    'stand','stark','start','state','stays','steal','steam','steel','steep',
    'steer','stern','stick','stiff','still','stock','stone','stood','store',
    'storm','story','stove','strap','straw','strip','stuck','study','stuff',
    'style','sugar','suite','super','surge','swamp','sweep','sweet','swift',
    'swing','sword','sworn','syrup','table','taken','talks','taste','teach',
    'teams','teeth','tempo','tenth','terry','texas','thank','theme','there',
    'thick','thing','think','third','those','three','threw','throw','thumb',
    'tiger','tight','timer','tired','title','toast','today','token','total',
    'touch','tough','tower','toxic','trace','track','trade','trail','train',
    'trait','trash','treat','trend','trial','tribe','trick','tried','troop',
    'truck','truly','trunk','trust','truth','tumor','twice','twist',
    'ultra','under','unfit','union','unite','unity','until','upper','upset',
    'urban','usage','usher','usual','valid','value','vapor','vault','venue',
    'verse','video','vigor','vinyl','viral','virus','visit','vital','vivid',
    'vocal','vodka','voice','voter','wages','waste','watch','water','weave',
    'wheat','wheel','where','which','while','white','whole','whose','wider',
    'witch','woman','women','world','worse','worst','worth','would','wound',
    'wrath','write','wrong','wrote','xerox','yacht','yield','young','yours',
    'youth','zones',
  ]
  candidates.push(...words5)

  return candidates
}

// ============================================================================
// Daily Cache Logic
// ============================================================================

/**
 * Check if data needs refresh (once per day).
 * First visitor of the day triggers a refresh; subsequent visitors use cached DB data.
 */
export function needsRefresh(): boolean {
  const db = useDatabase()
  const row = db.prepare(
    "SELECT setting_value FROM notification_settings WHERE account_id = 0 AND setting_key = 'dropcatch_last_refresh'"
  ).get() as { setting_value: string } | undefined

  if (!row) return true

  const lastRefresh = new Date(row.setting_value)
  const now = new Date()
  // Refresh if last refresh was before today
  return lastRefresh.toDateString() !== now.toDateString()
}

/**
 * Mark today as refreshed so subsequent visitors use cached data.
 */
export function markRefreshed(): void {
  const db = useDatabase()
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO notification_settings (account_id, setting_key, setting_value) VALUES (0, 'dropcatch_last_refresh', ?) ON CONFLICT(account_id, setting_key) DO UPDATE SET setting_value = ?"
  ).run(now, now)
}

// ============================================================================
// Main Fetch Function
// ============================================================================

// Mutex to prevent concurrent refreshes
let isRefreshing = false

/**
 * Fetch real dropping/expired/available pure-letter domains via RDAP checks.
 *
 * - Generates pure-letter candidates (2-5 chars)
 * - Checks each via RDAP with 300ms rate limiting
 * - Only keeps domains that are available, pending_delete, expired, or expiring (within 10 days)
 * - For valuable registered short domains (<=4 letter .com), adds as auction monitoring targets
 * - Max 100 results per TLD
 * - Imports found domains into the drop_domains table
 *
 * @returns number of domains imported
 */
export async function fetchRealDropDomains(options?: {
  tlds?: string[]
  maxPerTld?: number
  domains?: string[] // Manual domain list to check instead of generating
}): Promise<number> {
  // Prevent concurrent refreshes
  if (isRefreshing) {
    console.log('[dropcatch] Refresh already in progress, skipping')
    return 0
  }

  isRefreshing = true
  try {
    const tlds = options?.tlds || ['.com', '.net', '.org']
    const maxPerTld = options?.maxPerTld || 100

    // Determine which domains to check
    let domainsToCheck: string[]
    if (options?.domains && options.domains.length > 0) {
      // Manual mode: check specific domains provided by user
      domainsToCheck = options.domains
        .map(d => d.toLowerCase().trim())
        .filter(d => {
          if (!d.includes('.') || d.length < 2) return false
          const sld = d.split('.')[0]
          // Pure letters only, max 5 chars
          return /^[a-z]+$/.test(sld) && sld.length <= 5
        })
    } else {
      // Auto mode: generate candidates and combine with TLDs
      const candidates = generateLetterCandidates()
      // Shuffle to get variety on each run
      const shuffled = candidates.sort(() => Math.random() - 0.5)
      domainsToCheck = []
      for (const name of shuffled) {
        for (const tld of tlds) {
          domainsToCheck.push(`${name}.${tld.replace(/^\./, '')}`)
        }
      }
    }

    // Track results per TLD
    const countPerTld = new Map<string, number>()
    for (const tld of tlds) {
      countPerTld.set(tld, 0)
    }

    const found: {
      domain_name: string
      status: string
      expiryDate?: string
      registrar?: string
      source: string
    }[] = []

    // Check domains via RDAP in parallel batches of 10 for speed
    const BATCH_SIZE = 10
    const MAX_CHECKS = 600 // Max total RDAP checks per refresh (~60s at 10 parallel)
    let checksCount = 0

    for (let i = 0; i < domainsToCheck.length && checksCount < MAX_CHECKS; i += BATCH_SIZE) {
      // Check if ALL TLDs are full
      const allFull = tlds.every(t => (countPerTld.get(t) || 0) >= maxPerTld)
      if (allFull) break

      const batch = domainsToCheck.slice(i, i + BATCH_SIZE).filter(domain => {
        const tld = '.' + domain.split('.').slice(1).join('.')
        return (countPerTld.get(tld) || 0) < maxPerTld
      })

      if (batch.length === 0) continue

      // Run batch in parallel
      const results = await Promise.allSettled(
        batch.map(domain => checkDomainViaRdap(domain).then(r => ({ domain, result: r })))
      )
      checksCount += batch.length

      for (const settled of results) {
        if (settled.status !== 'fulfilled' || !settled.value.result) continue
        const { domain, result } = settled.value
        const tld = '.' + domain.split('.').slice(1).join('.')
        const sld = domain.split('.')[0]
        const currentCount = countPerTld.get(tld) || 0

        if (result.status === 'available' || result.status === 'pending_delete' || result.status === 'expired' || result.status === 'expiring') {
          found.push({
            domain_name: domain,
            status: result.status,
            expiryDate: result.expiryDate,
            registrar: result.registrar,
            source: 'rdap',
          })
          countPerTld.set(tld, currentCount + 1)
        } else if (result.status === 'registered' && sld.length <= 4 && tld === '.com') {
          found.push({
            domain_name: domain,
            status: 'registered',
            expiryDate: result.expiryDate,
            registrar: result.registrar,
            source: 'auction',
          })
        }
      }

      // Brief delay between batches
      await new Promise(r => setTimeout(r, RDAP_REQUEST_DELAY))
    }

    console.log(`[dropcatch] Scanned ${checksCount} domains, found ${found.length} results`)

    // Import found domains into database
    if (found.length > 0) {
      const toImport = found.map(d => ({
        domain_name: d.domain_name,
        tld: '.' + d.domain_name.split('.').slice(1).join('.'),
        drop_date: d.expiryDate || '',
        status: d.status,
        source: d.source,
        registrar: d.registrar || '',
        estimated_value: 0,
      }))

      return importDropDomains(toImport)
    }

    return 0
  } finally {
    isRefreshing = false
  }
}

// ============================================================================
// Import Drop Domains
// ============================================================================

/**
 * Import drop domains into the database (upsert).
 * Only imports pure-letter domains with length 1-5.
 */
/**
 * Calculate a realistic auction/catch price based on domain properties.
 * This estimates what the domain would typically go for at auction.
 */
function calculateAuctionPrice(domainName: string, tld: string, estimatedValue: number): number {
  const sld = domainName.split('.')[0]
  const len = sld.length

  // Base: auction prices are typically 10-30% of estimated value
  let price = Math.round(estimatedValue * 0.15)

  // Adjust by TLD
  if (tld === '.com') {
    // .com auction prices are higher
    if (len <= 2) price = Math.max(price, 5000)
    else if (len === 3) price = Math.max(price, 500)
    else if (len === 4) price = Math.max(price, 100)
    else price = Math.max(price, 30)
  } else if (tld === '.net' || tld === '.org') {
    if (len <= 3) price = Math.max(price, 200)
    else price = Math.max(price, 20)
  }

  // Round to nice numbers
  if (price >= 1000) price = Math.round(price / 100) * 100
  else if (price >= 100) price = Math.round(price / 10) * 10

  return price
}

export function importDropDomains(domains: any[]): number {
  const db = useDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO drop_domains (domain_name, tld, drop_date, status, source, estimated_value, auction_price, domain_length, has_numbers, has_hyphens, is_pure_letters, is_pure_numbers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let count = 0
  const insert = db.transaction((items: any[]) => {
    for (const d of items) {
      const analysis = analyzeDomain(d.domain_name)

      // Skip non-pure-letter domains
      if (!analysis.isPureLetters) continue
      // Skip domains longer than 5 characters
      if (analysis.length > 5) continue

      const estValue = d.estimated_value || 0
      const auctionPrice = d.auction_price || calculateAuctionPrice(d.domain_name, d.tld || analysis.tld, estValue)

      stmt.run(
        d.domain_name, d.tld || analysis.tld, d.drop_date || '',
        d.status || 'pending_delete', d.source || 'rdap',
        estValue, auctionPrice, analysis.length,
        analysis.hasNumbers ? 1 : 0, analysis.hasHyphens ? 1 : 0,
        analysis.isPureLetters ? 1 : 0, analysis.isPureNumbers ? 1 : 0
      )
      count++
    }
  })
  insert(domains)
  return count
}
