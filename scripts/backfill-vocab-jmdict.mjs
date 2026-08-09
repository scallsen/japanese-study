#!/usr/bin/env node
/**
 * Backfills a `jmdictId` field onto every Vocab Drill word (src/data/words/*.json)
 * and bundled SRS deck entry (core2000.json, keigo.json) by matching it against
 * the Supabase `dictionary` table. This is the linkage that lets the app treat
 * `dictionary` as the source of truth for definitions/readings.
 *
 * Matching requires the candidate dictionary row's kana_forms to include the
 * word's own reading whenever we have one to check — a primary_form hit with no
 * reading match is left UNMATCHED rather than risking a wrong-homograph link.
 * keigo.json has no separate kana field (front is already the spoken form), so
 * its matches skip reading verification — spot-check those in the report.
 *
 * Run: node --env-file=.env scripts/backfill-vocab-jmdict.mjs
 * Writes unmatched entries to backfill-vocab-jmdict-report.json for manual
 * review; does not fail the run.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const SELECT = 'id, primary_form, kanji_forms, kana_forms, common'

const TARGETS = [
  { path: 'src/data/words/nsm_n3_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n3_i4_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n3_i5_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n2_a1_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/modules/vocab-srs/decks/core2000.json', formField: 'front', kanaField: 'kana' },
  { path: 'src/modules/vocab-srs/decks/keigo.json', formField: 'front', kanaField: null },
]

function pickBest(rows) {
  if (!rows.length) return null
  return rows.slice().sort((a, b) => (b.common === true) - (a.common === true) || a.primary_form.length - b.primary_form.length)[0]
}

// Matches a single word to a dictionary row. Requires the reading to line up
// whenever we have one to check against, to avoid linking to the wrong homograph.
function matchWord(word, formField, kanaField, byPrimaryForm, byKanaForm) {
  const form = word[formField]
  // When there's no separate reading field, the form itself is already kana
  // (e.g. Core 2000's `front: "する"` has no `kana` — see CLAUDE.md's "use kana
  // if no kanji form" convention).
  const kana = kanaField ? (word[kanaField] ?? form) : null
  if (!form) return null

  const primaryCandidates = byPrimaryForm.get(form) ?? []
  if (primaryCandidates.length) {
    if (!kana) return pickBest(primaryCandidates)
    const readingMatched = primaryCandidates.filter(r => r.kana_forms.includes(kana))
    return readingMatched.length ? pickBest(readingMatched) : null
  }

  if (kana) {
    let kanaCandidates = byKanaForm.get(kana) ?? []
    if (form !== kana) {
      // We have a specific kanji form to match against.
      kanaCandidates = kanaCandidates.filter(r => r.kanji_forms.includes(form) || r.kanji_forms.length === 0)
    } else if (kanaCandidates.length > 1) {
      // Pure-kana source word (no kanji in our data) with multiple kanji-bearing
      // homophone candidates (e.g. する → 為る/刷る/掏る/剃る/擦る) — only trust an
      // unambiguous match: a single candidate, or the one with no kanji form itself.
      const kanaOnly = kanaCandidates.filter(r => r.kanji_forms.length === 0)
      kanaCandidates = kanaOnly.length === 1 ? kanaOnly : []
    }
    if (kanaCandidates.length) return pickBest(kanaCandidates)
  }

  return null
}

async function fetchByPrimaryForm(forms) {
  const map = new Map()
  const unique = [...new Set(forms)]
  const BATCH = 200
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data, error } = await supabase.from('dictionary').select(SELECT).in('primary_form', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      if (!map.has(row.primary_form)) map.set(row.primary_form, [])
      map.get(row.primary_form).push(row)
    }
  }
  return map
}

async function fetchByKanaForm(kanas) {
  const map = new Map()
  const unique = [...new Set(kanas)]
  const BATCH = 50 // .overlaps() queries are heavier — keep batches small
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data, error } = await supabase.from('dictionary').select(SELECT).overlaps('kana_forms', chunk)
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

async function processTarget(target, report) {
  console.log(`\nProcessing ${target.path}`)
  const entries = JSON.parse(readFileSync(target.path, 'utf8'))

  const forms = entries.map(e => e[target.formField]).filter(Boolean)
  const byPrimaryForm = await fetchByPrimaryForm(forms)

  const needsKanaFallback = entries.filter(e => {
    const form = e[target.formField]
    if (!form) return false
    const candidates = byPrimaryForm.get(form) ?? []
    if (!candidates.length) return true
    const kana = target.kanaField ? e[target.kanaField] : null
    if (!kana) return false
    return !candidates.some(r => r.kana_forms.includes(kana))
  })
  const kanas = target.kanaField ? needsKanaFallback.map(e => e[target.kanaField]).filter(Boolean) : []
  const byKanaForm = kanas.length ? await fetchByKanaForm(kanas) : new Map()

  let matched = 0
  let changed = false
  for (const entry of entries) {
    const row = matchWord(entry, target.formField, target.kanaField, byPrimaryForm, byKanaForm)
    if (row) {
      if (entry.jmdictId !== row.id) { entry.jmdictId = row.id; changed = true }
      matched++
    } else {
      if ('jmdictId' in entry) { delete entry.jmdictId; changed = true }
      report.push({ file: target.path, id: entry.id, form: entry[target.formField], kana: target.kanaField ? entry[target.kanaField] : null })
    }
  }

  console.log(`  Matched ${matched}/${entries.length}`)
  if (changed) {
    writeFileSync(target.path, JSON.stringify(entries, null, 2) + '\n')
    console.log(`  Wrote ${target.path}`)
  }
}

async function main() {
  const report = []
  for (const target of TARGETS) {
    await processTarget(target, report)
  }

  if (report.length) {
    const reportPath = 'backfill-vocab-jmdict-report.json'
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    console.log(`\n${report.length} entries left unmatched — see ${reportPath} for manual review.`)
  } else {
    console.log('\nAll entries matched.')
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
