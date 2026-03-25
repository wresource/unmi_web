import { defineEventHandler } from 'h3'
import { isDropCatchConfigured, testDropCatchAuth } from '~/server/utils/dropcatch-api'

export default defineEventHandler(async () => {
  const configured = isDropCatchConfigured()

  if (!configured) {
    return {
      configured: false,
      authenticated: false,
    }
  }

  const authResult = await testDropCatchAuth()

  return {
    configured: true,
    authenticated: authResult.ok,
    error: authResult.error,
  }
})
