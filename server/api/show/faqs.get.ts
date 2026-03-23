import { defineEventHandler } from 'h3'
import { useDatabase } from '~/server/database'

export default defineEventHandler(() => {
  const db = useDatabase()
  const faqs = db.prepare(
    'SELECT id, question, answer, category FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
  ).all()

  return { success: true, data: faqs }
})
