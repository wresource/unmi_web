import { defineEventHandler } from 'h3'
import { getRegistrarList } from '~/server/utils/pricing'

export default defineEventHandler(async () => {
  const list = await getRegistrarList()
  return { data: list.filter(r => r.active) }
})
