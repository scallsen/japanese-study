#!/usr/bin/env node
/**
 * Imports jmdict-simplified JSON into the Supabase `dictionary` table.
 * Run once (or re-run to refresh): node --env-file=.env scripts/import-jmdict.mjs [path/to/jmdict-eng.json]
 * If no path argument is given, auto-downloads the latest release from GitHub.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Before running, create the table in the Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS dictionary (
 *     id           text PRIMARY KEY,
 *     primary_form text NOT NULL,
 *     kana_forms   text[] NOT NULL DEFAULT '{}',
 *     gloss_en     text,
 *     pos          text[],
 *     common       boolean NOT NULL DEFAULT false,
 *     kanji_forms  text[] NOT NULL DEFAULT '{}',
 *     senses       jsonb
 *   );
 *   CREATE INDEX IF NOT EXISTS dictionary_primary_form_idx ON dictionary (primary_form);
 *   CREATE INDEX IF NOT EXISTS dictionary_kana_forms_gin   ON dictionary USING GIN (kana_forms);
 *   CREATE INDEX IF NOT EXISTS dictionary_common_idx       ON dictionary (common);
 *   GRANT SELECT ON dictionary TO anon, authenticated;
 *
 *   -- If upgrading an existing table, run these first:
 *   ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS kanji_forms text[] NOT NULL DEFAULT '{}';
 *   ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS senses jsonb;
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
  // Assets are distributed as .json.zip — prefer the full english dict
  const asset = release.assets.find(a => /^jmdict-eng-\d/.test(a.name) && a.name.endsWith('.json.zip'))
  if (!asset) throw new Error('No jmdict-eng JSON zip asset found in latest release')
  console.log(`Downloading: ${asset.name} (${Math.round(asset.size / 1024 / 1024)}MB)`)
  const dlRes = await fetch(asset.browser_download_url)
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`)
  const tmpZip = join(tmpdir(), 'jmdict-import.zip')
  writeFileSync(tmpZip, Buffer.from(await dlRes.arrayBuffer()))
  console.log('Extracting...')
  const text = execSync(`unzip -p "${tmpZip}"`, { maxBuffer: 200 * 1024 * 1024 }).toString()
  unlinkSync(tmpZip)
  return text
}

function transformEntry(entry) {
  const primaryForm = entry.kanji.length > 0 ? entry.kanji[0].text : entry.kana[0].text
  const kanjiForms = entry.kanji.map(k => k.text)
  const kanaForms = entry.kana.map(k => k.text)
  const common = entry.kanji.some(k => k.common) || entry.kana.some(k => k.common)
  const glossEn = entry.sense
    .flatMap(s => s.gloss.filter(g => g.lang === 'eng').map(g => g.text))
    .join('; ') || null
  const posSet = new Set(entry.sense.flatMap(s => s.partOfSpeech))
  const pos = posSet.size > 0 ? [...posSet] : null
  const senses = entry.sense.map(s => {
    const sense = { gloss: s.gloss.filter(g => g.lang === 'eng').map(g => g.text) }
    if (s.partOfSpeech?.length) sense.pos = s.partOfSpeech
    if (s.field?.length) sense.field = s.field
    if (s.misc?.length) sense.misc = s.misc
    if (s.info?.length) sense.info = s.info
    if (s.related?.length) sense.related = s.related.map(r => r[0])
    if (s.antonym?.length) sense.antonym = s.antonym.map(r => r[0])
    return sense
  })
  return { id: entry.id, primary_form: primaryForm, kanji_forms: kanjiForms, kana_forms: kanaForms, gloss_en: glossEn, pos, common, senses }
}

async function main() {
  console.log('Loading JMdict data...')
  const text = await resolveSource()

  console.log('Parsing JSON...')
  const { words } = JSON.parse(text)
  console.log(`Loaded ${words.length} entries.`)

  console.log('Clearing existing dictionary rows...')
  const { error: delErr } = await supabase.from('dictionary').delete().neq('id', '')
  if (delErr) {
    console.warn(`Delete step failed: ${delErr.message}`)
    console.warn('If this timed out, run TRUNCATE dictionary; in the Supabase SQL editor, then re-run this script.')
  }

  console.log(`Inserting in batches of ${BATCH_SIZE}...`)
  let inserted = 0
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE).map(transformEntry)
    const { error } = await supabase.from('dictionary').insert(batch)
    if (error) throw new Error(`Insert failed at batch starting index ${i}: ${error.message}`)
    inserted += batch.length
    if (Math.floor(i / BATCH_SIZE) % 50 === 0) console.log(`  ${inserted}/${words.length}`)
  }
  console.log(`Inserted ${inserted} entries.`)

  const { count } = await supabase
    .from('dictionary')
    .select('id', { count: 'exact', head: true })
    .eq('common', true)
  console.log(`Common entries: ${count}`)
  console.log('Done. To prune uncommon entries later: DELETE FROM dictionary WHERE NOT common;')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
