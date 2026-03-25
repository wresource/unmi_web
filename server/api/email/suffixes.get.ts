import { defineEventHandler } from 'h3'
import { getKnownEmailSuffixes } from '~/server/utils/email'

export default defineEventHandler(() => {
  return { data: getKnownEmailSuffixes() }
})
