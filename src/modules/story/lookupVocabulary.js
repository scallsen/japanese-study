import { supabase } from '../../lib/supabase.js'

const SELECT = 'id, primary_form, kana_forms, gloss_en, pos, common'

function pickBest(rows) {
  if (!rows.length) return null
  return rows.slice().sort((a, b) => (b.common === true) - (a.common === true) || a.primary_form.length - b.primary_form.length)[0]
}

// Looks up JMdict entries for the content tokens of a generated story.
// Two-stage query mirroring scripts/fetch-nhk.mjs: primary_form match on the
// base form, then kana_forms GIN overlap for kana bases whose JMdict primary
// form is kanji (e.g. ある → 有る).
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

  const found = new Map()
  const { data: primaryRows, error: primaryError } = await supabase
    .from('dictionary').select(SELECT).in('primary_form', bases)
  if (primaryError) {
    console.error('[lookupVocabulary] primary_form query failed:', primaryError)
    return []
  }
  for (const base of bases) {
    const best = pickBest((primaryRows ?? []).filter(r => r.primary_form === base))
    if (best) found.set(base, best)
  }

  const remaining = bases.filter(b => !found.has(b))
  if (remaining.length) {
    const { data: kanaRows, error: kanaError } = await supabase
      .from('dictionary').select(SELECT).overlaps('kana_forms', remaining)
    if (kanaError) console.error('[lookupVocabulary] kana_forms query failed:', kanaError)
    for (const base of remaining) {
      const best = pickBest((kanaRows ?? []).filter(r => r.kana_forms.includes(base)))
      if (best) found.set(base, best)
    }
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
