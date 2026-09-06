import { supabase } from '../lib/supabase.js'
import { displayFormOf } from '../lib/displayForm.js'

export { displayFormOf }

const cache = new Map()
const attempted = new Set()

// `misc0` is only sense 0's misc array, not the whole `senses` blob — it costs
// a few bytes per row and carries the `uk` flag `displayFormOf` needs. The full
// blob is deliberately absent: measured over 200 common entries it takes a row
// from 294 to 488 bytes, and every consumer of this lookup would pay that —
// including the anime episode browser, which resolves hundreds of ids at once —
// for something only the handful of cards that name a sense read. Those go
// through fetchSenseGlosses below instead.
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

const senseCache = new Map()
const senseAttempted = new Set()

// Returns { [jmdictId]: gloss[][] } — the gloss list of each sense, for ids a
// word points a sense at. Separate from fetchDictionaryEntries on purpose (see
// SELECT above): ~87 of the 1,861 bundled words name a sense, so this fetches a
// few rows per drill rather than fattening every dictionary lookup in the app.
export async function fetchSenseGlosses(ids) {
  const unique = [...new Set(ids)].filter(Boolean)
  const missing = unique.filter(id => !senseAttempted.has(id))
  if (missing.length > 0 && supabase) {
    const { data } = await supabase.from('dictionary').select('id, senses').in('id', missing)
    missing.forEach(id => senseAttempted.add(id))
    if (data) for (const row of data) senseCache.set(row.id, (row.senses ?? []).map(s => s?.gloss ?? []))
  }
  const result = {}
  for (const id of unique) {
    if (senseAttempted.has(id)) result[id] = senseCache.get(id) ?? null
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
  return trimGlosses(row.gloss_en.split('; '), count, maxChars)
}

// The definition a card should show. A word may name which of the entry's
// senses its textbook is teaching — JMdict orders senses by general prominence,
// so あげる's "to give" sits at sense 5 of 上げる, behind "to raise; to elevate",
// and the first three glosses would answer a question the book never asked.
// `senseGlosses` is the map from useSenseGlosses/fetchSenseGlosses; without it
// (or before it resolves) this falls back to the entry's leading glosses, which
// is also what a word that names no sense always gets.
export function cardGloss(word, row, senseGlosses) {
  const gloss = word?.sense != null ? senseGlosses?.[word.jmdictId]?.[word.sense] : null
  if (gloss?.length) return trimGlosses(gloss)
  return briefGloss(row)
}

function trimGlosses(all, count = 3, maxChars = 60) {
  const senses = all.slice(0, count)
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
