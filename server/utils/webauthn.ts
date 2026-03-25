import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/types'

const challenges = new Map<string, { challenge: string; expires: number }>()

// Cleanup expired challenges every 5 min
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of challenges) {
    if (now > val.expires) challenges.delete(key)
  }
}, 300000)

function getConfig() {
  return {
    rpID: process.env.WEBAUTHN_RP_ID || 'beta.unmi.io',
    rpName: process.env.WEBAUTHN_RP_NAME || 'UnMi Domain Manager',
    origin: process.env.WEBAUTHN_ORIGIN || 'https://beta.unmi.io',
  }
}

export function storeChallenge(key: string, challenge: string) {
  challenges.set(key, { challenge, expires: Date.now() + 120000 }) // 2 min TTL
}

export function getChallenge(key: string): string | null {
  const entry = challenges.get(key)
  if (!entry || Date.now() > entry.expires) {
    challenges.delete(key)
    return null
  }
  challenges.delete(key) // one-time use
  return entry.challenge
}

export async function createRegistrationOptions(
  accountId: number,
  accountName: string,
  existingCredentialIds: string[],
) {
  const config = getConfig()
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: accountName || `user-${accountId}`,
    attestationType: 'none',
    excludeCredentials: existingCredentialIds.map(id => ({
      id: Buffer.from(id, 'base64url'),
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
  storeChallenge(`reg:${accountId}`, options.challenge)
  return options
}

export async function verifyRegistration(
  accountId: number,
  response: RegistrationResponseJSON,
) {
  const config = getConfig()
  const expectedChallenge = getChallenge(`reg:${accountId}`)
  if (!expectedChallenge) throw new Error('Challenge expired or not found')

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
  })

  return verification
}

export async function createAuthenticationOptions(credentialIds: string[]) {
  const config = getConfig()
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials: credentialIds.map(id => ({
      id: Buffer.from(id, 'base64url'),
    })),
    userVerification: 'preferred',
  })
  storeChallenge(`auth:global`, options.challenge)
  return options
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  credentialPublicKey: string,
  credentialCounter: number,
) {
  const config = getConfig()
  const expectedChallenge = getChallenge(`auth:global`)
  if (!expectedChallenge) throw new Error('Challenge expired')

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: response.id,
      publicKey: Buffer.from(credentialPublicKey, 'base64url'),
      counter: credentialCounter,
    },
  })

  return verification
}
