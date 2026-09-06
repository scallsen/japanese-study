#!/usr/bin/env node
/**
 * Generates Voicevox neural TTS audio for the vocab word lists and the keigo SRS
 * deck, and uploads MP3s to Supabase Storage.
 *
 * A clip is stored under audio/voicevox/<speakerId>/<key>.mp3, where the key is
 * a hash of THE TEXT SPOKEN rather than of the word that wanted it. One reading
 * is therefore stored once however many lists teach it, while two cards of one
 * dictionary entry that say different things (勉強, 勉強する) keep separate
 * clips. Nothing is written back into the word files: whether a clip exists is
 * a fact about a reading, and storage is where that fact lives — a card whose
 * clip is missing simply falls back to browser speech synthesis.
 *
 * It also prunes clips no list speaks any more. Because the key is the reading,
 * a word list leaving the repo cannot orphan a clip another list still uses,
 * which is what the old per-list keep-list existed to prevent.
 *
 * Requires a running Voicevox engine (desktop app, or the headless
 * voicevox/voicevox_engine Docker image) reachable at VOICEVOX_URL.
 *
 * Run manually: node --env-file=.env scripts/generate-audio.mjs
 * Runs automatically via .github/workflows/generate-vocab-audio.yml on every push
 * touching src/data/words/** or the keigo deck.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   VOICEVOX_URL (default http://localhost:50021)
 */

import { createClient } from '@supabase/supabase-js'
import { audioKeyFor, speechTextOf } from '../src/lib/displayForm.js'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021'

// Clips in flight. The engine is CPU-bound and the uploads are independent, so
// a handful at once is a large win; too many just queues inside the engine.
// Override with AUDIO_CONCURRENCY when running against a beefier machine.
const CONCURRENCY = Number(process.env.AUDIO_CONCURRENCY ?? 6)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUCKET = 'audio'

// Keep in sync with VOICEVOX_VOICES in src/utils/voicevoxAudio.js
const VOICES = [
  { id: 2, name: 'shikoku-metan' },
  { id: 11, name: 'kurono-takehiro' },
]

// Discovered from disk (not hardcoded) so a new word-list JSON dropped into
// src/data/words/ is picked up automatically — a hardcoded list here previously
// let new files (e.g. a newly added word list) silently get no audio at all.
const WORD_LIST_DIR = 'src/data/words'
const TARGETS = [
  ...readdirSync(WORD_LIST_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => ({ path: `${WORD_LIST_DIR}/${f}`, textField: 'kana' })),
  { path: 'src/modules/vocab-srs/decks/keigo.json', textField: 'front' },
]

async function confirmSpeakers() {
  const res = await fetch(`${VOICEVOX_URL}/speakers`)
  if (!res.ok) throw new Error(`Failed to reach Voicevox engine at ${VOICEVOX_URL}: ${res.status}`)
  const speakers = await res.json()
  for (const voice of VOICES) {
    const found = speakers.some(s => s.styles.some(style => style.id === voice.id))
    if (!found) throw new Error(`Speaker id ${voice.id} (${voice.name}) not found on this Voicevox engine`)
  }
}

async function synthesize(text, speakerId, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const queryRes = await fetch(`${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, { method: 'POST' })
      if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`)
      const query = await queryRes.json()

      const synthRes = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${speakerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      })
      if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`)
      return Buffer.from(await synthRes.arrayBuffer())
    } catch (err) {
      if (attempt >= retries) throw err
      console.warn(`    retry after error: ${err.message}`)
    }
  }
}

async function wavToMp3(wavBuffer) {
  const stamp = `voicevox-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const wavPath = join(tmpdir(), `${stamp}.wav`)
  const mp3Path = join(tmpdir(), `${stamp}.mp3`)
  writeFileSync(wavPath, wavBuffer)
  await execFileAsync('ffmpeg', ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', mp3Path])
  return readFileSync(mp3Path)
}

async function uploadAudio(speakerId, key, mp3Buffer) {
  const path = `voicevox/${speakerId}/${key}.mp3`
  const { error } = await supabase.storage.from(BUCKET).upload(path, mp3Buffer, {
    upsert: true,
    contentType: 'audio/mpeg',
  })
  if (error) throw new Error(`Upload failed (${path}): ${error.message}`)
}

async function deleteAudio(speakerId, filename) {
  const path = `voicevox/${speakerId}/${filename}`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn(`  Failed to delete ${path}: ${error.message}`)
}

// Word entries aren't required to carry their own `kana` once they're linked to
// the dictionary (see CLAUDE.md's word data format), and what a card SAYS also
// depends on the entry — する is re-appended, decoration is not spoken. So the
// whole row is needed, not just a reading.
async function fetchEntries(ids) {
  const map = new Map()
  const unique = [...new Set(ids)].filter(Boolean)
  const BATCH = 200
  for (let i = 0; i < unique.length; i += BATCH) {
    const { data, error } = await supabase.from('dictionary')
      .select('id, primary_form, preferred_form, kana_forms, misc0:senses->0->misc')
      .in('id', unique.slice(i, i + BATCH))
    if (error) throw error
    for (const row of data ?? []) map.set(row.id, row)
  }
  return map
}

// Which clips already exist, so a run only makes what is missing. Replaces the
// per-word voicevoxVoices bookkeeping: existence is a fact about a reading, and
// storage is where that fact lives.
async function listExistingKeys(speakerId) {
  const keys = new Set()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .list(`voicevox/${speakerId}`, { limit: 1000, offset })
    if (error) throw error
    for (const f of data) keys.add(f.name.replace(/\.mp3$/, ''))
    if (data.length < 1000) break
  }
  return keys
}

async function setStatus(status) {
  const { error } = await supabase
    .from('audio_generation_status')
    .upsert({ id: 'vocab-audio', status, updated_at: new Date().toISOString() })
  if (error) console.warn(`Failed to set status to "${status}": ${error.message}`)
}

// Deletes any file under audio/voicevox/<speakerId>/ that no current word asks
// for. Clips are keyed by what they say, so one is orphaned only when NO list
// uses that reading any more — which is why per-list keep-lists are no longer
// needed: a word list leaving the repo cannot orphan a reading another list
// still speaks.
async function reconcileVoice(speakerId, validKeys) {
  const { data, error } = await supabase.storage.from(BUCKET).list(`voicevox/${speakerId}`, { limit: 10000 })
  if (error) { console.warn(`  Failed to list voicevox/${speakerId}: ${error.message}`); return }
  const expected = new Set([...validKeys].map(k => `${k}.mp3`))
  const orphans = (data ?? []).filter(f => !expected.has(f.name))
  for (const file of orphans) {
    console.log(`  Pruning orphaned voicevox/${speakerId}/${file.name}`)
    await deleteAudio(speakerId, file.name)
  }
}

// Bounded worker pool: `limit` tasks in flight, results ignored (each task
// handles its own failure), so one bad clip never aborts the run.
async function inParallel(items, limit, worker) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

async function generate() {
  await confirmSpeakers()

  // One clip per distinct spoken text, not per word: several lists teach the
  // same word, and what differs between two cards of one entry — 勉強 against
  // 勉強する — is exactly what speechTextOf reflects. So keying on it keeps
  // those apart while collapsing everything that genuinely sounds the same.
  const entriesByPath = new Map()
  const allIds = []
  for (const target of TARGETS) {
    const rows = JSON.parse(readFileSync(target.path, 'utf8'))
    entriesByPath.set(target.path, rows)
    allIds.push(...rows.map(e => e.jmdictId))
  }
  const dict = await fetchEntries(allIds)

  const textByKey = new Map()
  for (const target of TARGETS) {
    for (const entry of entriesByPath.get(target.path)) {
      // keigo.json speaks its `front`; a word list speaks the card's reading.
      const text = target.textField === 'front'
        ? entry.front
        : speechTextOf(entry, entry.jmdictId ? dict.get(entry.jmdictId) : null) ?? entry.kana
      if (!text) continue
      const key = audioKeyFor(text)
      const seen = textByKey.get(key)
      // Two readings sharing a key would silently serve each other's audio.
      if (seen && seen !== text) {
        throw new Error(`audio key collision: ${JSON.stringify(seen)} and ${JSON.stringify(text)}`)
      }
      textByKey.set(key, text)
    }
  }
  console.log(`${textByKey.size} distinct spoken texts across ${TARGETS.length} lists`)

  const allKeys = new Set(textByKey.keys())

  for (const voice of VOICES) {
    const existing = await listExistingKeys(voice.id)
    const jobs = [...textByKey].filter(([key]) => !existing.has(key)).map(([key, text]) => ({ key, text }))
    console.log(`\n${voice.name}: ${existing.size} clip(s) present, ${jobs.length} to generate`)
    if (!jobs.length) continue

    let done = 0
    await inParallel(jobs, CONCURRENCY, async ({ key, text }) => {
      try {
        const wav = await synthesize(text, voice.id)
        const mp3 = await wavToMp3(wav)
        await uploadAudio(voice.id, key, mp3)
      } catch (err) {
        console.warn(`  Failed (${text}): ${err.message}`)
      }
      done++
      if (done % 25 === 0 || done === jobs.length) process.stdout.write(`\r  ${done}/${jobs.length}`)
    })
    process.stdout.write('\n')
  }

  console.log('\nReconciling storage (pruning orphaned audio)...')
  for (const voice of VOICES) {
    await reconcileVoice(voice.id, allKeys)
  }

  console.log('\nDone.')
}

async function main() {
  await setStatus('processing')
  try {
    await generate()
  } finally {
    await setStatus('idle')
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
