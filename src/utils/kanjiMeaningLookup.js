import { supabase } from '../lib/supabase.js'

const cache = new Map()
const attempted = new Set()

export function kanjiCharsOf(kanjiStr) {
  return [...(kanjiStr ?? '')].filter(ch => /\p{Script=Han}/u.test(ch))
}

// Returns { [literal]: firstGlossOrEmptyString } for every char already resolved (found or not).
export async function fetchKanjiMeanings(chars) {
  const unique = [...new Set(chars)]
  const missing = unique.filter(ch => !attempted.has(ch))
  if (missing.length > 0 && supabase) {
    const { data } = await supabase.from('kanji').select('literal, meanings').in('literal', missing)
    missing.forEach(ch => attempted.add(ch))
    if (data) {
      for (const row of data) cache.set(row.literal, (row.meanings ?? '').split('; ')[0] ?? '')
    }
  }
  const result = {}
  for (const ch of unique) {
    if (attempted.has(ch)) result[ch] = cache.get(ch) ?? ''
  }
  return result
}
