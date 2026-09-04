// Resolves a batch of raw Jiten WordDto objects to `dictionary.id` (JMdict)
// values. Mirrors the reading-verified matching in scripts/backfill-vocab-jmdict.mjs
// (reject a primary_form hit whose kana_forms don't include one of the word's
// own readings, to avoid linking the wrong homograph) generalized to Jiten
// words, which can carry several kanji/kana candidate forms per word rather
// than one fixed pair. Never drops a word — an unresolved word keeps
// jmdictId: null with its best-available surface form for display.
//
// `client` is an injected Supabase client (works from Node scripts and,
// eventually, browser code) — Deno edge functions can't import this file
// directly and keep their own duplicated copy, same as word-import/index.ts
// duplicates src/lib/dictionaryLookup.js.

import { pickBestDictionaryMatch } from '../../../lib/dictionaryLookup.js'
import { extractWordForms } from './wordClassification.js'

const SELECT = 'id, primary_form, kanji_forms, kana_forms, common'
// Unlike the numeric/ASCII ids other lookups in this codebase batch at 200,
// these are Japanese kanji/kana forms — each character percent-encodes to ~9
// URL characters, so a batch of 200 can push the request past PostgREST's
// ~16KB header limit (confirmed live: HeadersOverflowError at batch size 200
// for kanji-heavy chunks). 50 keeps every real-world batch well under that.
const PRIMARY_BATCH = 50
const KANA_BATCH = 50

async function fetchByPrimaryForm(client, forms) {
  const map = new Map()
  const unique = [...new Set(forms)]
  for (let i = 0; i < unique.length; i += PRIMARY_BATCH) {
    const chunk = unique.slice(i, i + PRIMARY_BATCH)
    if (!chunk.length) continue
    const { data, error } = await client.from('dictionary').select(SELECT).in('primary_form', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      if (!map.has(row.primary_form)) map.set(row.primary_form, [])
      map.get(row.primary_form).push(row)
    }
  }
  return map
}

async function fetchByKanaForm(client, kanas) {
  const map = new Map()
  const unique = [...new Set(kanas)]
  for (let i = 0; i < unique.length; i += KANA_BATCH) {
    const chunk = unique.slice(i, i + KANA_BATCH)
    if (!chunk.length) continue
    const { data, error } = await client.from('dictionary').select(SELECT).overlaps('kana_forms', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      for (const k of row.kana_forms) {
        if (!chunk.includes(k)) continue
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(row)
      }
    }
  }
  return map
}

// jitenWords: raw WordDto[] (must each have a unique `wordId`).
// Returns Map<wordId, { jmdictId: string|null, surfaceForm: string }>.
export async function resolveJmdictIds(client, jitenWords) {
  const formsByWordId = new Map(jitenWords.map(w => [w.wordId, extractWordForms(w)]))
  const result = new Map()

  const allKanji = [...formsByWordId.values()].flatMap(f => f.kanjiForms)
  const byPrimaryForm = await fetchByPrimaryForm(client, allKanji)

  const needsKanaFallback = []
  for (const word of jitenWords) {
    const { kanjiForms, kanaForms } = formsByWordId.get(word.wordId)
    let matched = null
    let matchedForm = null
    for (const kanji of kanjiForms) {
      const candidates = byPrimaryForm.get(kanji) ?? []
      if (!candidates.length) continue
      const verified = kanaForms.length ? candidates.filter(r => kanaForms.some(k => r.kana_forms.includes(k))) : candidates
      if (verified.length) { matched = pickBestDictionaryMatch(verified); matchedForm = kanji; break }
    }
    // surfaceForm is the specific form that verified against the dictionary,
    // not just kanjiForms[0] — Jiten's frequency-sorted first candidate for a
    // word isn't necessarily the one that actually matched (and can itself be
    // a messy/composite reading), so falling back to it here would display an
    // unverified form even though jmdictId correctly points at a clean entry.
    if (matched) result.set(word.wordId, { jmdictId: matched.id, surfaceForm: matchedForm ?? kanjiForms[0] ?? kanaForms[0] ?? word.mainReading?.text })
    else needsKanaFallback.push(word)
  }

  if (needsKanaFallback.length) {
    const fallbackKana = needsKanaFallback.flatMap(w => formsByWordId.get(w.wordId).kanaForms)
    const byKanaForm = await fetchByKanaForm(client, fallbackKana)

    for (const word of needsKanaFallback) {
      const { kanjiForms, kanaForms } = formsByWordId.get(word.wordId)
      let matched = null
      let matchedForm = null
      for (const kana of kanaForms) {
        let candidates = byKanaForm.get(kana) ?? []
        if (!candidates.length) continue
        if (kanjiForms.length) {
          candidates = candidates.filter(r => kanjiForms.some(k => r.kanji_forms.includes(k)) || r.kanji_forms.length === 0)
        } else if (candidates.length > 1) {
          // Pure-kana word with multiple kanji-bearing homophone candidates —
          // only trust an unambiguous match (see backfill-vocab-jmdict.mjs).
          const kanaOnly = candidates.filter(r => r.kanji_forms.length === 0)
          candidates = kanaOnly.length === 1 ? kanaOnly : []
        }
        if (candidates.length) { matched = pickBestDictionaryMatch(candidates); matchedForm = kana; break }
      }
      result.set(word.wordId, {
        jmdictId: matched?.id ?? null,
        // matchedForm (the verified kana) only when a match was actually
        // found — an unresolved word still falls back to its best-guess
        // display form, same as before.
        surfaceForm: matchedForm ?? kanjiForms[0] ?? kanaForms[0] ?? word.mainReading?.text,
      })
    }
  }

  return result
}
