import { supabase } from '../../lib/supabase.js'
import { lookupDictionaryEntries } from '../../lib/dictionaryLookup.js'

// Looks up JMdict entries for the content tokens of a generated story.
// Returns entries in the vocabulary_ja shape keyed by SURFACE form
// ({ word, meaning, pos, jmdictId }) so buildVocabMap matches clicked tokens.
export async function lookupVocabulary(tokens) {
  const surfacesByBase = new Map()
  for (const tok of tokens ?? []) {
    if (!tok.w || !tok.t) continue
    const base = tok.b || tok.t
    if (!surfacesByBase.has(base)) surfacesByBase.set(base, new Set())
    surfacesByBase.get(base).add(tok.t)
  }
  const bases = [...surfacesByBase.keys()]
  if (!bases.length) return []

  let found
  try {
    found = await lookupDictionaryEntries(supabase, bases)
  } catch (err) {
    console.error('[lookupVocabulary] dictionary lookup failed:', err)
    return []
  }

  const vocabulary = []
  for (const [base, surfaces] of surfacesByBase) {
    const row = found.get(base)
    if (!row) continue
    for (const surface of surfaces) {
      vocabulary.push({ word: surface, meaning: row.gloss_en, pos: row.pos?.[0] ?? null, jmdictId: row.id })
    }
  }
  return vocabulary
}
