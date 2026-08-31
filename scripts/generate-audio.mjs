#!/usr/bin/env node
/**
 * Generates Voicevox neural TTS audio for the vocab word lists and the keigo SRS
 * deck, uploads MP3s to Supabase Storage (audio/voicevox/<speakerId>/<entryId>.mp3),
 * writes the generated speaker ids back into each entry's `voicevoxVoices` array,
 * and prunes any stored audio whose entry no longer exists in the source JSON.
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
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const VOICEVOX_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021'

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

async function uploadAudio(speakerId, entryId, mp3Buffer) {
  const path = `voicevox/${speakerId}/${entryId}.mp3`
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

// Vocab Drill word entries aren't required to carry their own `kana` once
// they're linked to the dictionary (see CLAUDE.md's word data format) — fall
// back to the dictionary's own reading so those entries still get audio.
async function fetchReadingsByJmdictId(ids) {
  const map = new Map()
  const unique = [...new Set(ids)]
  const BATCH = 200
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data, error } = await supabase.from('dictionary').select('id, kana_forms').in('id', chunk)
    if (error) throw error
    for (const row of data ?? []) map.set(row.id, row.kana_forms?.[0] ?? null)
  }
  return map
}

async function setStatus(status) {
  const { error } = await supabase
    .from('audio_generation_status')
    .upsert({ id: 'vocab-audio', status, updated_at: new Date().toISOString() })
  if (error) console.warn(`Failed to set status to "${status}": ${error.message}`)
}

// Deletes any file under audio/voicevox/<speakerId>/ whose entry no longer exists
// in the current source JSON — keeps storage in sync when words/cards are removed.
async function reconcileVoice(speakerId, validEntryIds) {
  const { data, error } = await supabase.storage.from(BUCKET).list(`voicevox/${speakerId}`, { limit: 10000 })
  if (error) { console.warn(`  Failed to list voicevox/${speakerId}: ${error.message}`); return }
  const expected = new Set([...validEntryIds].map(id => `${id}.mp3`))
  const orphans = (data ?? []).filter(f => !expected.has(f.name))
  for (const file of orphans) {
    console.log(`  Pruning orphaned voicevox/${speakerId}/${file.name}`)
    await deleteAudio(speakerId, file.name)
  }
}

async function generate() {
  await confirmSpeakers()

  const allEntryIds = []

  for (const target of TARGETS) {
    console.log(`\nProcessing ${target.path}`)
    const entries = JSON.parse(readFileSync(target.path, 'utf8'))
    let changed = false

    const needsFallback = entries.filter(e => !e[target.textField] && e.jmdictId)
    const readingByJmdictId = needsFallback.length
      ? await fetchReadingsByJmdictId(needsFallback.map(e => e.jmdictId))
      : new Map()

    for (const entry of entries) {
      allEntryIds.push(entry.id)
      const text = entry[target.textField] ?? (entry.jmdictId ? readingByJmdictId.get(entry.jmdictId) : null)
      if (!text) continue

      entry.voicevoxVoices = entry.voicevoxVoices ?? []

      for (const voice of VOICES) {
        if (entry.voicevoxVoices.includes(voice.id)) continue

        console.log(`  Generating ${entry.id} (${voice.name}): ${text}`)
        try {
          const wav = await synthesize(text, voice.id)
          const mp3 = await wavToMp3(wav)
          await uploadAudio(voice.id, entry.id, mp3)
          entry.voicevoxVoices.push(voice.id)
          changed = true
        } catch (err) {
          console.warn(`  Failed (${entry.id}, ${voice.name}): ${err.message}`)
        }
      }
    }

    if (changed) {
      writeFileSync(target.path, JSON.stringify(entries, null, 2) + '\n')
      console.log(`  Wrote ${target.path}`)
    }
  }

  console.log('\nReconciling storage (pruning orphaned audio)...')
  for (const voice of VOICES) {
    await reconcileVoice(voice.id, allEntryIds)
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
