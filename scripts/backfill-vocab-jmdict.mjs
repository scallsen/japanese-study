#!/usr/bin/env node
/**
 * Backfills a `jmdictId` field onto every Vocab Drill word (src/data/words/*.json)
 * and bundled SRS deck entry (keigo.json) by matching it against
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
import { resolveJmdictMatches, matchKey } from '../src/lib/dictionaryLookup.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TARGETS = [
  { path: 'src/data/words/nsm_n3_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n3_i4_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n3_i5_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/data/words/nsm_n2_a1_vocab.json', formField: 'kanji', kanaField: 'kana' },
  { path: 'src/modules/vocab-srs/decks/keigo.json', formField: 'front', kanaField: null },
]

async function processTarget(target, report) {
  console.log(`\nProcessing ${target.path}`)
  const entries = JSON.parse(readFileSync(target.path, 'utf8'))

  // When there's no separate reading field, the form itself is already kana
  // (see CLAUDE.md's "use kana if no kanji form" convention). keigo.json has no
  // reading concept at all (kanaField: null), so its matches skip reading
  // verification entirely.
  const words = entries.map(e => ({
    form: e[target.formField],
    kana: target.kanaField ? (e[target.kanaField] ?? e[target.formField]) : null,
  }))
  const matches = await resolveJmdictMatches(supabase, words)

  let matched = 0
  let changed = false
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const { form, kana } = words[i]
    const row = matches.get(matchKey(form, kana))
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
