import { defineEventHandler, readBody, createError, setResponseHeader } from 'h3'
import { lookupDomain } from '~/server/utils/whois'
import { lookupDomainPricing } from '~/server/utils/pricing'
import { appraiseDomain } from '~/server/utils/appraisal'
import { checkWhoisRateLimit } from '~/server/utils/ratelimit'
import { getClientIp } from '~/server/utils/clientip'

export default defineEventHandler(async (event) => {
  // Rate limiting
  const clientIp = getClientIp(event)
  const rateCheck = checkWhoisRateLimit(clientIp)
  if (!rateCheck.allowed) {
    setResponseHeader(event, 'Retry-After', String(rateCheck.retryAfter))
    throw createError({ statusCode: 429, statusMessage: rateCheck.reason || '请求过于频繁' })
  }

  const body = await readBody(event)
  const domainName = body?.domain?.trim()?.toLowerCase()

  if (!domainName) {
    throw createError({ statusCode: 400, statusMessage: 'domain is required' })
  }

  // Run WHOIS and pricing queries in parallel
  const [whoisResult, pricingResult] = await Promise.allSettled([
    lookupDomain(domainName),
    lookupDomainPricing(domainName),
  ])

  const whois = whoisResult.status === 'fulfilled' ? whoisResult.value : null
  const pricing = pricingResult.status === 'fulfilled' ? pricingResult.value : null

  // Appraise domain (synchronous, fast)
  const appraisal = appraiseDomain(domainName, whois?.registrationDate)

  if (!whois && !pricing) {
    return {
      success: false,
      error: 'Failed to query domain information',
      data: { domain_name: domainName },
      appraisal,
    }
  }

  return {
    success: true,
    data: {
      domain_name: domainName,
      registrar: whois?.registrar || '',
      registration_date: whois?.registrationDate ? whois.registrationDate.split('T')[0] : '',
      expiry_date: whois?.expiryDate ? whois.expiryDate.split('T')[0] : '',
      dns_servers: whois?.nameservers?.join(', ') || '',
      status: whois ? mapStatus(whois.status, whois.expiryDate) : 'active',
      auto_renew: false,
      // Pricing data
      renewal_price: pricing?.suggestedRenewPrice ?? 0,
      purchase_price: pricing?.suggestedPurchasePrice ?? 0,
      currency: pricing?.suggestedCurrency || 'CNY',
    },
    whois: whois
      ? {
          registered: whois.registered,
          status: whois.status,
          dnssec: whois.dnssec,
          registrantOrg: whois.registrantOrg,
          registrantCountry: whois.registrantCountry,
          source: whois.source,
          updatedDate: whois.updatedDate,
        }
      : null,
    pricing: pricing
      ? {
          tld: pricing.tld,
          prices: pricing.pricing.prices,
          cheapestNew: pricing.pricing.cheapestNew,
          cheapestRenew: pricing.pricing.cheapestRenew,
          cheapestTransfer: pricing.pricing.cheapestTransfer,
        }
      : null,
    appraisal,
  }
})

function mapStatus(whoisStatus: string[], expiryDate: string | null): string {
  const statusStr = whoisStatus.join(' ').toLowerCase()
  if (statusStr.includes('pendingdelete') || statusStr.includes('pending delete')) return 'pending_delete'
  if (statusStr.includes('redemption')) return 'redemption'
  if (statusStr.includes('pendtransfer') || statusStr.includes('pending transfer')) return 'transferring'
  if (expiryDate) {
    const expiry = new Date(expiryDate)
    if (expiry < new Date()) return 'expired'
  }
  return 'active'
}
