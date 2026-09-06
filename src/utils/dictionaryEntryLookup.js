import { supabase } from '../lib/supabase.js'
import { displayFormOf } from '../lib/displayForm.js'

export { displayFormOf }

const cache = new Map()
const attempted = new Set()

// `misc0` is only sense 0's misc array, not the whole `senses` blob — it costs
// a few bytes per row and carries the `uk` flag `displayFormOf` needs.
const SELECT = 'id, primary_form, preferred_form, kana_forms, gloss_en, pos, common, jlpt_level, jlpt_level_inferred, misc0:senses->0->misc'

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


// Concise definition text for card display — first couple of gloss segments,
// further capped by character count so a handful of long senses (e.g. 枚数's
// "number of flat objects; sheet count; tally of individual pieces") can't
// still blow past a card's fixed height on their own. Whole senses are kept
// where possible; only the boundary sense gets hard-truncated.
export function briefGloss(row, count = 3, maxChars = 60) {
  if (!row?.gloss_en) return null
  const senses = row.gloss_en.split('; ').slice(0, count)
  const full = senses.join('; ')
  if (full.length <= maxChars) return full

  const kept = [senses[0]]
  let len = senses[0].length
  for (const sense of senses.slice(1)) {
    const next = len + 2 + sense.length
    if (next > maxChars) break
    kept.push(sense)
    len = next
  }
  let result = kept.join('; ')
  if (result.length > maxChars) result = result.slice(0, maxChars - 1).trimEnd()
  return `${result}…`
}
