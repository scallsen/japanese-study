#!/usr/bin/env node
/**
 * Imports word-level JLPT difficulty tags into the `dictionary` table.
 *
 * Source: https://github.com/stephenmk/yomitan-jlpt-vocab (CC BY-SA 4.0,
 * © Stephen Kraus 2021-2025), which converts Jonathan Waller's JLPT
 * Resources list (tanos.co.uk, CC BY — the same de-facto community list
 * Jisho.org uses) into a JMdict-id-matched dataset. There is no *official*
 * JLPT vocabulary list — the Japan Foundation stopped publishing one when
 * the test moved from 4 levels to N1-N5 in 2010 (this is also why JMdict
 * itself dropped its old JLPT field, calling it "the FORMER JLPT level").
 * Treat jlpt_level as a community-estimated approximation, never as
 * official/certified data, in any UI copy that surfaces it.
 *
 * ShareAlike note: CC BY-SA only obligates re-distributions of this
 * specific dataset (or direct derivatives of it) to stay under compatible
 * terms — it does not extend to this repo's code or other data. Attribution
 * lives in src/data/attributions.js ('jlpt-vocab').
 *
 * If this source ever needs replacing (e.g. for a fully permissive license
 * with no ShareAlike obligation), the next-best option found during
 * research is https://github.com/elzup/jlpt-word-list (MIT, ultimately the
 * same Waller/tanos.co.uk root data via chyyran/jlpt-anki-decks) — that one
 * ships expression+reading only (no JMdict ids), so it would need to go
 * through the same reading-verified matching this script already does,
 * rather than the direct id join used below.
 *
 * Run once (or re-run to refresh on a new stephenmk release):
 *   node --env-file=.env scripts/import-jlpt-vocab.mjs
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Before running for the first time, add the column in the Supabase SQL editor:
 *
 *   ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS jlpt_level text;
 *   CREATE INDEX IF NOT EXISTS dictionary_jlpt_level_idx ON dictionary(jlpt_level);
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const LEVELS = ['n1', 'n2', 'n3', 'n4', 'n5']
// Easiest first — when the same word carries conflicting levels across
// Waller's own level files (~450 words do, e.g. tagged both N3 and N5), the
// easier tag wins, since that's the conservative choice for a "hide basic
// words" filter: if any sense/reading of a word is elementary, a learner
// has likely already met some form of it.
const LEVEL_ORDER = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
const CSV_BASE = 'https://raw.githubusercontent.com/stephenmk/yomitan-jlpt-vocab/master/original_data'
const ID_BATCH = 200

// Minimal CSV line parser — handles double-quoted fields containing commas
// (waller_definition values like "to open, to become open").
function parseCsv(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const fields = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else cur += ch
      } else if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(cur); cur = '' }
      else cur += ch
    }
    fields.push(cur)
    rows.push(fields)
  }
  const [header, ...body] = rows
  return body.map(f => Object.fromEntries(header.map((h, i) => [h, f[i]])))
}

async function fetchLevel(level) {
  const res = await fetch(`${CSV_BASE}/${level}.csv`)
  if (!res.ok) throw new Error(`Failed to fetch ${level}.csv (${res.status})`)
  return parseCsv(await res.text())
}

async function fetchDictionaryByIds(ids) {
  const map = new Map()
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const chunk = ids.slice(i, i + ID_BATCH)
    const { data, error } = await supabase.from('dictionary').select('id, kana_forms').in('id', chunk)
    if (error) throw error
    for (const row of data ?? []) map.set(row.id, row)
  }
  return map
}

async function main() {
  const allRows = []
  for (const level of LEVELS) {
    const rows = await fetchLevel(level)
    console.log(`${level.toUpperCase()}: ${rows.length} words`)
    for (const r of rows) allRows.push({ id: r.jmdict_seq, kana: r.kana, level: level.toUpperCase() })
  }
  console.log(`Total: ${allRows.length} words across all levels`)

  const dict = await fetchDictionaryByIds(allRows.map(r => r.id))

  const levelById = new Map()
  const notFound = []
  const kanaMismatch = []
  for (const r of allRows) {
    if (!r.id) { notFound.push(r); continue }
    const row = dict.get(r.id)
    if (!row) { notFound.push(r); continue }
    // Reading-verified, same reasoning as backfill-vocab-jmdict.mjs — the
    // JMdict snapshot this app imports and the one Waller's list was last
    // checked against can drift (entries merged/renumbered), so a raw id
    // join isn't trustworthy without confirming the reading still matches.
    if (!row.kana_forms?.includes(r.kana)) { kanaMismatch.push({ ...r, dictKana: row.kana_forms }); continue }
    const existing = levelById.get(r.id)
    if (!existing || LEVEL_ORDER[r.level] < LEVEL_ORDER[existing]) levelById.set(r.id, r.level)
  }

  console.log(`Matched: ${levelById.size}, not found: ${notFound.length}, kana mismatch: ${kanaMismatch.length}`)

  // Group by level and use plain UPDATE (not upsert) — every id here already
  // exists in `dictionary` (we just fetched it above), and supabase-js's
  // upsert() builds its INSERT against the whole row shape, so it fails
  // NOT NULL on columns like primary_form that aren't in this payload even
  // when the row already exists and only an UPDATE was ever needed
  // (confirmed live: 23502 "null value in column primary_form"). A plain
  // UPDATE only ever touches the column we specify.
  const idsByLevel = new Map()
  for (const [id, level] of levelById) {
    if (!idsByLevel.has(level)) idsByLevel.set(level, [])
    idsByLevel.get(level).push(id)
  }
  for (const [level, ids] of idsByLevel) {
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const chunk = ids.slice(i, i + ID_BATCH)
      const { error } = await supabase.from('dictionary').update({ jlpt_level: level }).in('id', chunk)
      if (error) throw error
    }
    console.log(`  ${level}: updated ${ids.length} words`)
  }

  if (notFound.length || kanaMismatch.length) {
    writeFileSync('import-jlpt-vocab-report.json', JSON.stringify({ notFound, kanaMismatch }, null, 2))
    console.log('Unmatched/mismatched entries written to import-jlpt-vocab-report.json')
  }
  console.log('Done.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
