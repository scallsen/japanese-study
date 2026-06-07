#!/usr/bin/env node
// Uploads Anki audio files to Supabase Storage (audio/imported/).
//
// Usage:
//   node --env-file=.env.local scripts/upload-audio.mjs \
//     --tsv  "/path/to/Core 2000.txt" \
//     --media "/path/to/Anki2/{profile}/collection.media"
//
// Required env vars (in .env.local):
//   VITE_SUPABASE_URL      — same value as in the app
//   SUPABASE_SERVICE_KEY   — service role key from Supabase dashboard (Settings → API)
//                            Keep this in .env.local only — never commit or share it.
//
// Before running: create the 'audio' bucket manually in the Supabase dashboard
// (Storage → New bucket, set to Public).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const BUCKET = 'audio'
const DEST_PREFIX = 'imported'

// ── args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const get = name => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null }

const tsvPath  = get('--tsv')
const mediaDir = get('--media')

if (!tsvPath || !mediaDir) {
  console.error('Usage: node --env-file=.env.local scripts/upload-audio.mjs --tsv <path> --media <path>')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const secretKey   = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !secretKey) {
  console.error('Missing env vars. Ensure .env.local contains VITE_SUPABASE_URL and SUPABASE_SECRET_KEY.')
  process.exit(1)
}

// ── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(supabaseUrl, secretKey)

// ── Parse TSV ────────────────────────────────────────────────────────────────

function extractSound(field) {
  const m = (field || '').match(/\[sound:([^\]]+)\]/)
  return m ? m[1] : null
}

const tsv = readFileSync(tsvPath, 'utf8')
const filenames = new Set()

for (const line of tsv.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const cols = trimmed.split('\t')
  if (cols.length < 14) continue
  const word     = extractSound(cols[5])
  const sentence = extractSound(cols[13])
  if (word) filenames.add(word)
  if (sentence) filenames.add(sentence)
}

const files = [...filenames]
console.log(`Found ${files.length} audio files in TSV\n`)

// ── Upload ───────────────────────────────────────────────────────────────────

let uploaded = 0, missing = 0, failed = 0

for (const filename of files) {
  const localPath = join(mediaDir, filename)

  if (!existsSync(localPath)) {
    console.warn(`MISSING  ${filename}`)
    missing++
    continue
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${DEST_PREFIX}/${filename}`, readFileSync(localPath), {
      upsert: true,
      contentType: 'audio/mpeg',
    })

  if (error) {
    console.error(`ERROR    ${filename}: ${error.message}`)
    failed++
  } else {
    uploaded++
    if (uploaded % 100 === 0) process.stdout.write(`${uploaded}/${files.length}…\n`)
  }
}

console.log(`\nDone — ${uploaded} uploaded, ${missing} missing locally, ${failed} errors`)
if (missing > 0) console.log('Missing files were not in your media folder — safe to ignore if those cards have no audio.')
