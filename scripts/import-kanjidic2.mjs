#!/usr/bin/env node
/**
 * Imports kanjidic2-simplified JSON into the Supabase `kanji` table.
 * Run once: node --env-file=.env scripts/import-kanjidic2.mjs [path/to/kanjidic2-eng.json]
 * If no path argument is given, auto-downloads the latest release from GitHub.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Before running, create the table in the Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS kanji (
 *     literal       text PRIMARY KEY,
 *     on_readings   text[] NOT NULL DEFAULT '{}',
 *     kun_readings  text[] NOT NULL DEFAULT '{}',
 *     readings_hira text[] NOT NULL DEFAULT '{}',
 *     meanings      text NOT NULL DEFAULT '',
 *     jlpt          smallint,
 *     grade         smallint,
 *     stroke_count  smallint,
 *     frequency     smallint
 *   );
 *   CREATE INDEX IF NOT EXISTS kanji_readings_hira_gin ON kanji USING GIN (readings_hira);
 *   ALTER TABLE kanji ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read" ON kanji FOR SELECT USING (true);
 *   GRANT SELECT ON kanji TO anon, authenticated;
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
  const asset = release.assets.find(a => /^kanjidic2-en-\d/.test(a.name) && a.name.endsWith('.json.zip'))
  if (!asset) throw new Error('No kanjidic2-eng JSON zip asset found in latest release')
  console.log(`Downloading: ${asset.name} (${Math.round(asset.size / 1024)}KB)`)
  const dlRes = await fetch(asset.browser_download_url)
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`)
  const tmpZip = join(tmpdir(), 'kanjidic2-import.zip')
  writeFileSync(tmpZip, Buffer.from(await dlRes.arrayBuffer()))
  console.log('Extracting...')
  const text = execSync(`unzip -p "${tmpZip}"`, { maxBuffer: 50 * 1024 * 1024 }).toString()
  unlinkSync(tmpZip)
  return text
}

function katakanaToHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function stripOkurigana(kun) {
  return kun.replace(/[.\-].*/g, '').trim()
}

function transformEntry(entry) {
  const onHira = (entry.on ?? []).map(katakanaToHiragana)
  const kunBase = (entry.kun ?? []).map(stripOkurigana).filter(Boolean)
  const readingsHira = [...new Set([...onHira, ...kunBase])]
  return {
    literal: entry.literal,
    on_readings: entry.on ?? [],
    kun_readings: entry.kun ?? [],
    readings_hira: readingsHira,
    meanings: (entry.meanings ?? []).join('; '),
    jlpt: entry.jlpt_new ?? null,
    grade: entry.grade ?? null,
    stroke_count: entry.stroke_count ?? null,
    frequency: entry.frequency ?? null,
  }
}

async function main() {
  console.log('Loading KANJIDIC2 data...')
  const text = await resolveSource()

  console.log('Parsing JSON...')
  const { characters } = JSON.parse(text)
  console.log(`Loaded ${characters.length} entries.`)

  console.log('Clearing existing kanji rows...')
  const { error: delErr } = await supabase.from('kanji').delete().neq('literal', '')
  if (delErr) {
    console.warn(`Delete step failed: ${delErr.message}`)
    console.warn('If this timed out, run TRUNCATE kanji; in the Supabase SQL editor, then re-run this script.')
  }

  console.log(`Inserting in batches of ${BATCH_SIZE}...`)
  let inserted = 0
  for (let i = 0; i < characters.length; i += BATCH_SIZE) {
    const batch = characters.slice(i, i + BATCH_SIZE).map(transformEntry)
    const { error } = await supabase.from('kanji').insert(batch)
    if (error) throw new Error(`Insert failed at batch starting index ${i}: ${error.message}`)
    inserted += batch.length
    if (Math.floor(i / BATCH_SIZE) % 10 === 0) console.log(`  ${inserted}/${characters.length}`)
  }
  console.log(`Inserted ${inserted} entries.`)

  const { count } = await supabase
    .from('kanji')
    .select('literal', { count: 'exact', head: true })
  console.log(`Total kanji in table: ${count}`)
  console.log('Done.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
