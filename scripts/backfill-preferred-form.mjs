#!/usr/bin/env node
/**
 * Backfills `dictionary.preferred_form` — the form a word should actually be
 * displayed as.
 *
 * `primary_form` is "the first kanji form, else the first kana form", which
 * jmdict-simplified orders without regard to whether that form is one anybody
 * writes. JMdict tags a rarely-used kanji form `rK` (also `sK` search-only,
 * `oK` outdated, `iK` irregular), and the import dropped those tags, so
 * それから became 其れから, カレー became 咖哩 and ゆうべ became 昨夜 — headwords no
 * dictionary site shows and no textbook prints.
 *
 * This is NOT the same signal as the sense-level `uk` ("usually written using
 * kana alone"), which correctly handles ちょっと/たくさん and is applied separately
 * at render time. `uk` says how a word is written; `rK` says this particular
 * kanji spelling is not the one in use. 其れから carries no `uk` on any sense.
 *
 * Non-destructive by design: it writes one column and never deletes a row, so
 * unlike re-running import-jmdict.mjs it preserves `jlpt_level` and
 * `jlpt_level_inferred`, which were backfilled separately afterwards.
 *
 * A NULL `preferred_form` means "primary_form is already the right form" —
 * only rows that actually differ are written, which is a few thousand of
 * 217k rather than all of them.
 *
 * Run: node --env-file=.env scripts/backfill-preferred-form.mjs [path/to/jmdict-eng.json]
 *
 * Requires the column:
 *   ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS preferred_form text;
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const BATCH_SIZE = 500

// A kanji form carrying any of these is not the spelling in ordinary use.
const UNUSED_FORM_TAGS = new Set(['rK', 'sK', 'oK', 'iK'])

export function preferredFormOf(entry) {
  const usable = entry.kanji.filter(k => !(k.tags ?? []).some(t => UNUSED_FORM_TAGS.has(t)))
  if (usable.length > 0) return usable[0].text
  // Every kanji spelling is rare/irregular, so the kana form is the real one.
  return entry.kana[0]?.text ?? null
}

async function resolveSource() {
  const arg = process.argv[2]
  if (arg) {
    console.log(`Using local file: ${arg}`)
    return readFileSync(arg, 'utf-8')
  }
  console.log('No file argument — fetching latest release from GitHub...')
  const apiRes = await fetch('https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest', {
    headers: { 'User-Agent': 'japanese-study-import' },
  })
  if (!apiRes.ok) throw new Error(`GitHub API error: ${apiRes.status}`)
  const release = await apiRes.json()
  const asset = release.assets.find(a => /^jmdict-eng-\d/.test(a.name) && a.name.endsWith('.json.zip'))
  if (!asset) throw new Error('No jmdict-eng JSON zip asset found in latest release')
  console.log(`Downloading: ${asset.name} (${Math.round(asset.size / 1024 / 1024)}MB)`)
  const dlRes = await fetch(asset.browser_download_url)
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`)
  const tmpZip = join(tmpdir(), 'jmdict-preferred.zip')
  writeFileSync(tmpZip, Buffer.from(await dlRes.arrayBuffer()))
  console.log('Extracting...')
  const text = execSync(`unzip -p "${tmpZip}"`, { maxBuffer: 400 * 1024 * 1024 }).toString()
  unlinkSync(tmpZip)
  return text
}

async function assertColumnExists() {
  const { error } = await supabase.from('dictionary').select('id, preferred_form').limit(1)
  if (!error) return
  console.error('\nThe `preferred_form` column does not exist yet. Run this in the Supabase SQL editor:\n')
  console.error('  ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS preferred_form text;\n')
  console.error(`(reported: ${error.message})`)
  process.exit(1)
}

await assertColumnExists()

const raw = await resolveSource()
console.log('Parsing...')
const { words } = JSON.parse(raw)
console.log(`${words.length} entries`)

// Only rows whose display form actually changes are written. `primary_form` is
// sent alongside because the upsert is an INSERT first, and that column is NOT
// NULL — it is rewritten to the value it already holds. Columns absent from the
// payload (jlpt_level, senses, …) are untouched by ON CONFLICT DO UPDATE.
const changed = []
for (const entry of words) {
  if (entry.kanji.length === 0) continue
  const primary = entry.kanji[0].text
  const preferred = preferredFormOf(entry)
  if (preferred && preferred !== primary) {
    changed.push({ id: entry.id, primary_form: primary, preferred_form: preferred })
  }
}

console.log(`${changed.length} entries display differently than primary_form (${(100 * changed.length / words.length).toFixed(1)}%)`)
console.log('Sample:')
for (const c of changed.slice(0, 8)) console.log(`  ${c.primary_form} → ${c.preferred_form}`)

// The dump is newer than the table it is backfilling — 3.6.2 carries ~1,000
// entries the original import predates — and an upsert INSERTS an id it does
// not find. That silently created ten stub rows (preferred_form set, no gloss,
// no kana forms) the first time this ran. Adding entries is import-jmdict.mjs's
// job; this script only ever updates rows that already exist.
const known = new Set()
for (let i = 0; i < changed.length; i += BATCH_SIZE) {
  const ids = changed.slice(i, i + BATCH_SIZE).map(c => c.id)
  const { data, error } = await supabase.from('dictionary').select('id').in('id', ids)
  if (error) { console.error(`\nExistence check failed: ${error.message}`); process.exit(1) }
  for (const row of data ?? []) known.add(row.id)
}
const skipped = changed.length - known.size
const updates = changed.filter(c => known.has(c.id))
if (skipped > 0) {
  console.log(`${skipped} entries are newer than this table and were skipped — run import-jmdict.mjs to add them`)
}

let written = 0
for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE)
  const { error } = await supabase.from('dictionary').upsert(batch, { onConflict: 'id' })
  if (error) {
    console.error(`\nBatch at ${i} failed: ${error.message}`)
    process.exit(1)
  }
  written += batch.length
  process.stdout.write(`\r  written ${written}/${updates.length}`)
}
console.log(`\nDone — ${written} rows updated.`)
