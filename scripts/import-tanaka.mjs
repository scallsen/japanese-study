#!/usr/bin/env node
/**
 * Imports the Tanaka Corpus (EDRDG, CC-BY licensed — https://www.edrdg.org/wiki/index.php/Tanaka_Corpus)
 * into the Supabase `sentences` table, resolving each sentence's per-word index
 * tags to `dictionary.id` values so sentences can be looked up by jmdictId
 * (see src/utils/sentenceLookup.js).
 *
 * Run once (or re-run to refresh): node --env-file=.env scripts/import-tanaka.mjs [path/to/examples.utf(.gz)]
 * If no path argument is given, downloads https://www.edrdg.org/pub/Nihongo/examples.utf.gz
 * (the ftp:// URL EDRDG's own docs reference isn't reachable from every network —
 * this https mirror on the www host serves the identical file over a valid cert).
 *
 * Corpus format (examples.utf), one sentence per A:/B: line pair:
 *   A: <japanese sentence>\t<english translation>#ID=<sentence id>
 *   B: <space-separated index tokens>
 * Each index token is HEADWORD[(READING|#JMDICT_ID)][[SENSE]][{SURFACE}][~] —
 * e.g. 彼(かれ)[01]  忙しい(いそがしい)  で(#2028980)  事(こと){こと}  忘我{忘我の}~
 * The trailing ~ flags the sentence as a recommended ("good") example for that
 * word. Bare tokens with no parens (mostly particles/copula) carry no linkage
 * and are skipped. A `(#nnnnnnn)` ref is already a JMdict sequence number, used
 * directly with no lookup; a `(reading)` needs matching against `dictionary`,
 * verified by reading the same way scripts/backfill-vocab-jmdict.mjs does —
 * accepting a headword-only (no reading) match is the one place this trades
 * away that verification, same tradeoff src/lib/dictionaryLookup.js already
 * makes for tokenized text with no reading available.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Before running, create the table in the Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS sentences (
 *     id             text PRIMARY KEY,
 *     japanese       text NOT NULL,
 *     english        text NOT NULL,
 *     dictionary_ids text[] NOT NULL DEFAULT '{}',
 *     quality        boolean NOT NULL DEFAULT false
 *   );
 *   CREATE INDEX IF NOT EXISTS sentences_dictionary_ids_gin ON sentences USING GIN (dictionary_ids);
 *   GRANT SELECT ON sentences TO anon, authenticated;
 *   GRANT ALL ON sentences TO service_role;
 *
 *   -- Supabase enables RLS on every new table by default — without a policy,
 *   -- anon/authenticated reads silently return zero rows (no error). Add the
 *   -- same "public read" policy dictionary/kanji already have:
 *   ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read" ON sentences FOR SELECT USING (true);
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { lookupDictionaryEntries, pickBestDictionaryMatch } from '../src/lib/dictionaryLookup.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const INSERT_BATCH = 500
const LOOKUP_BATCH = 200
const SOURCE_URL = 'https://www.edrdg.org/pub/Nihongo/examples.utf.gz'
const SELECT = 'id, primary_form, kanji_forms, kana_forms, common'

async function resolveSource() {
  const arg = process.argv[2]
  if (arg) {
    console.log(`Using local file: ${arg}`)
    const buf = readFileSync(arg)
    return arg.endsWith('.gz') ? gunzipSync(buf).toString('utf-8') : buf.toString('utf-8')
  }
  console.log(`No file argument — downloading ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`Downloaded ${Math.round(buf.length / 1024 / 1024)}MB, decompressing...`)
  return gunzipSync(buf).toString('utf-8')
}

const TOKEN_RE = /^([^(){}~]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?(?:\{([^}]+)\})?(~)?$/

function parseToken(tok) {
  const m = TOKEN_RE.exec(tok)
  if (!m) return null
  const [, headword, refOrReading, , , tilde] = m
  if (!headword) return null
  if (refOrReading?.startsWith('#')) {
    return { headword, jmdictId: refOrReading.slice(1), reading: null, quality: !!tilde }
  }
  return { headword, jmdictId: null, reading: refOrReading ?? null, quality: !!tilde }
}

function parseCorpus(text) {
  const lines = text.split('\n')
  const sentences = []
  let i = 0
  while (i < lines.length) {
    const aLine = lines[i]
    if (!aLine.startsWith('A: ')) { i++; continue }
    const bLine = lines[i + 1]
    if (!bLine || !bLine.startsWith('B: ')) { i++; continue }

    const aMatch = /^A: (.+)\t(.+?)#ID=(\S+)$/.exec(aLine)
    if (aMatch) {
      const [, japanese, english, id] = aMatch
      const tokens = bLine.slice(3).trim().split(/\s+/).map(parseToken).filter(Boolean)
      sentences.push({ id, japanese, english, tokens })
    }
    i += 2
  }
  return sentences
}

async function fetchByPrimaryForm(forms) {
  const map = new Map()
  const unique = [...new Set(forms)]
  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    const chunk = unique.slice(i, i + LOOKUP_BATCH)
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
  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    const chunk = unique.slice(i, i + LOOKUP_BATCH)
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

// Batches lookupDictionaryEntries (which issues one unbatched query per call)
// to avoid a single .in()/.overlaps() call with tens of thousands of values.
async function lookupInBatches(bases) {
  const merged = new Map()
  const unique = [...new Set(bases)]
  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    const chunk = unique.slice(i, i + LOOKUP_BATCH)
    const found = await lookupDictionaryEntries(supabase, chunk, { select: SELECT })
    for (const [k, v] of found) merged.set(k, v)
  }
  return merged
}

async function main() {
  const text = await resolveSource()
  console.log('Parsing corpus...')
  const sentences = parseCorpus(text)
  console.log(`Parsed ${sentences.length} sentence pairs.`)

  // Direct #id references need no lookup. Everything else needs matching.
  const readingPairs = new Map() // headword -> Set(reading)
  const headwordOnly = new Set()
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (t.jmdictId) continue
      if (t.reading) {
        if (!readingPairs.has(t.headword)) readingPairs.set(t.headword, new Set())
        readingPairs.get(t.headword).add(t.reading)
      } else {
        headwordOnly.add(t.headword)
      }
    }
  }

  console.log(`Resolving ${readingPairs.size} headword+reading forms against dictionary...`)
  const byPrimaryForm = await fetchByPrimaryForm([...readingPairs.keys()])
  const readingMatch = new Map() // "headword\u0000reading" -> dictionary id
  const needsKanaFallback = []
  for (const [headword, readings] of readingPairs) {
    const candidates = byPrimaryForm.get(headword) ?? []
    for (const reading of readings) {
      const matched = candidates.filter(r => r.kana_forms.includes(reading))
      if (matched.length) readingMatch.set(`${headword}\u0000${reading}`, pickBestDictionaryMatch(matched).id)
      else needsKanaFallback.push([headword, reading])
    }
  }
  if (needsKanaFallback.length) {
    console.log(`  ${needsKanaFallback.length} forms need kana-form fallback...`)
    const byKanaForm = await fetchByKanaForm(needsKanaFallback.map(([, r]) => r))
    for (const [headword, reading] of needsKanaFallback) {
      const candidates = (byKanaForm.get(reading) ?? []).filter(r => r.kanji_forms.includes(headword) || r.kanji_forms.length === 0)
      if (candidates.length) readingMatch.set(`${headword}\u0000${reading}`, pickBestDictionaryMatch(candidates).id)
    }
  }

  console.log(`Resolving ${headwordOnly.size} headword-only forms against dictionary...`)
  const headwordMatch = await lookupInBatches([...headwordOnly])

  console.log('Assigning dictionary ids to sentences...')
  const rows = []
  let skippedEmpty = 0
  for (const s of sentences) {
    const ids = new Set()
    let quality = false
    for (const t of s.tokens) {
      let id = null
      if (t.jmdictId) id = t.jmdictId
      else if (t.reading) id = readingMatch.get(`${t.headword}\u0000${t.reading}`) ?? null
      else id = headwordMatch.get(t.headword)?.id ?? null
      if (id) ids.add(id)
      if (t.quality) quality = true
    }
    if (ids.size === 0) { skippedEmpty++; continue }
    rows.push({ id: s.id, japanese: s.japanese, english: s.english, dictionary_ids: [...ids], quality })
  }
  console.log(`${rows.length} sentences have at least one dictionary link (${skippedEmpty} had none and were skipped).`)

  console.log('Clearing existing sentences rows...')
  const { error: delErr } = await supabase.from('sentences').delete().neq('id', '')
  if (delErr) {
    console.warn(`Delete step failed: ${delErr.message}`)
    console.warn('If this timed out, run TRUNCATE sentences; in the Supabase SQL editor, then re-run this script.')
  }

  console.log(`Inserting in batches of ${INSERT_BATCH}...`)
  let inserted = 0
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH)
    const { error } = await supabase.from('sentences').insert(batch)
    if (error) throw new Error(`Insert failed at batch starting index ${i}: ${error.message}`)
    inserted += batch.length
    if (Math.floor(i / INSERT_BATCH) % 20 === 0) console.log(`  ${inserted}/${rows.length}`)
  }
  console.log(`Inserted ${inserted} sentences.`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
