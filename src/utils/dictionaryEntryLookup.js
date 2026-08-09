import { supabase } from '../lib/supabase.js'

const cache = new Map()
const attempted = new Set()

const SELECT = 'id, primary_form, kana_forms, gloss_en, pos, common'

// Returns { [jmdictId]: row|null } for every id already resolved (found or not).
export async function fetchDictionaryEntries(ids) {
  const unique = [...new Set(ids)].filter(Boolean)
  const missing = unique.filter(id => !attempted.has(id))
  if (missing.length > 0 && supabase) {
    const { data } = await supabase.from('dictionary').select(SELECT).in('id', missing)
    missing.forEach(id => attempted.add(id))
    if (data) for (const row of data) cache.set(row.id, row)
  }
  const result = {}
  for (const id of unique) {
    if (attempted.has(id)) result[id] = cache.get(id) ?? null
  }
  return result
}

// Concise definition text for card display — first couple of gloss segments.
export function briefGloss(row, count = 3) {
  return row?.gloss_en ? row.gloss_en.split('; ').slice(0, count).join('; ') : null
}
