#!/usr/bin/env node
/**
 * Re-keys generated audio from word ids to the text each clip speaks.
 *
 * Clips used to be stored per word — audio/voicevox/<speaker>/<wordId>.mp3 —
 * so the same reading was stored once per list that taught it, and a list
 * leaving the repo orphaned files another list still needed. They are keyed by
 * the spoken text now (see src/lib/displayForm.js's audioKeyFor), which stores
 * each reading once and makes orphaning impossible.
 *
 * This copies what already exists rather than re-synthesising it. A clip is
 * only reusable if what it SAYS matches what the new scheme would say: some
 * were generated from text including display decoration (「むり（な）」,
 * 「～ばんせん」), and those are left behind for the generator to remake properly.
 *
 * Run: node --env-file=.env scripts/rekey-audio.mjs [--apply]
 * Copies only; deleting the old id-keyed files is generate-audio.mjs's prune
 * step, once you have confirmed playback works.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { speechTextOf, audioKeyFor } from '../src/lib/displayForm.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const BUCKET = 'audio'
const VOICES = [2, 11]
const APPLY = process.argv.includes('--apply')
const CONCURRENCY = Number(process.env.AUDIO_CONCURRENCY ?? 8)

async function inParallel(items, limit, worker) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++])
  }))
}

// Every word that ever had a clip, wherever it now lives: the repo's own lists,
// the learner's account, and the sentence-review words that were dropped — their
// clips are still in storage and are the source for many of these copies.
async function everyKnownWord() {
  const words = []
  for (const f of ['genki_1_vocab', 'genki_2_vocab', 'nsm_n3_kanji_vocab']) {
    try { words.push(...JSON.parse(readFileSync(`src/data/words/${f}.json`, 'utf8'))) } catch { /* absent */ }
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('custom_words').select('payload').range(from, from + 999)
    if (error) throw error
    words.push(...data.map(r => r.payload))
    if (data.length < 1000) break
  }
  try {
    words.push(...JSON.parse(readFileSync('scripts/vocab-input/sentence-vocab-backup.json', 'utf8')))
  } catch { /* no backup */ }
  return words
}

const words = await everyKnownWord()
const ids = [...new Set(words.map(w => w.jmdictId).filter(Boolean))]
const dict = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await supabase.from('dictionary')
    .select('id, primary_form, preferred_form, kana_forms, misc0:senses->0->misc')
    .in('id', ids.slice(i, i + 200))
  if (error) throw error
  for (const r of data ?? []) dict.set(r.id, r)
}

// What the OLD file for this word says: the generator fed it `kana`, or the
// dictionary reading when the word had none.
const spokenBefore = w => w.kana ?? (w.jmdictId ? dict.get(w.jmdictId)?.kana_forms?.[0] : null)
const spokenNow = w => speechTextOf(w, w.jmdictId ? dict.get(w.jmdictId) : null) ?? w.kana ?? null

// Every word that could supply this clip, not just the first one seen: many
// words share a reading and only some of them have a file, so committing to one
// candidate up front leaves usable clips behind and re-synthesises them.
const plan = new Map()   // newKey -> [candidate old word ids]
let mismatched = 0
for (const w of words) {
  const before = spokenBefore(w)
  const now = spokenNow(w)
  if (!before || !now) continue
  if (before !== now) { mismatched++; continue }   // clip says the decoration; remake it
  const key = audioKeyFor(now)
  if (!plan.has(key)) plan.set(key, [])
  plan.get(key).push(w.id)
}
console.log(`${words.length} known words → ${plan.size} clips can be re-keyed by copying`)
console.log(`${mismatched} word(s) have a clip whose text no longer matches — left for the generator`)

for (const voice of VOICES) {
  const existing = new Set()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(`voicevox/${voice}`, { limit: 1000, offset })
    if (error) throw error
    for (const f of data) existing.add(f.name.replace(/\.mp3$/, ''))
    if (data.length < 1000) break
  }
  const todo = []
  for (const [key, candidates] of plan) {
    if (existing.has(key)) continue
    const source = candidates.find(id => existing.has(id))
    if (source) todo.push([key, source])
  }
  console.log(`\nvoice ${voice}: ${existing.size} files present, ${todo.length} to copy`)
  if (!APPLY || !todo.length) continue

  let done = 0, failed = 0
  await inParallel(todo, CONCURRENCY, async ([key, oldId]) => {
    const { error } = await supabase.storage.from(BUCKET)
      .copy(`voicevox/${voice}/${oldId}.mp3`, `voicevox/${voice}/${key}.mp3`)
    if (error) { failed++; if (failed < 4) console.warn(`\n  ${oldId} → ${key}: ${error.message}`) }
    done++
    if (done % 100 === 0 || done === todo.length) process.stdout.write(`\r  ${done}/${todo.length}`)
  })
  console.log(`\n  copied ${done - failed}, failed ${failed}`)
}

if (!APPLY) console.log('\n(dry run — pass --apply to copy)')
