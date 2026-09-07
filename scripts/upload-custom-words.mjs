#!/usr/bin/env node
/**
 * Moves a learner's own word lists out of the bundle and into their account.
 *
 * The lists this uploads are course material, not a published textbook: one
 * class's re-chunking of a book, with its own example sentences and review
 * markers. They were shipping to every visitor in the bundle — 1.1 MB of it —
 * and they belong to one person, so they live in `custom_words` instead.
 *
 * Idempotent: rows are keyed (user_id, id), so re-running replaces rather than
 * duplicates. Nothing is deleted from the repo here; that is a separate step.
 * Their audio is unaffected either way — clips are keyed by what they say, not
 * by which word asked for one, so a list leaving the repo orphans nothing that
 * another list still speaks.
 *
 * Run: node --env-file=.env scripts/upload-custom-words.mjs <user-id> [--verify]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or a service-role key')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const userId = process.argv[2]
if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
  console.error('Usage: node --env-file=.env scripts/upload-custom-words.mjs <user-id> [--verify]')
  process.exit(1)
}

const FILES = [
  'src/data/words/nsm_n3_vocab.json',
  'src/data/words/nsm_n3_i4_vocab.json',
  'src/data/words/nsm_n3_i5_vocab.json',
  'src/data/words/nsm_n2_a1_vocab.json',
  'src/data/words/nsm_n2_a2_vocab.json',
  'src/data/words/sentence-vocab.json',
]
const BATCH = 500

if (process.argv.includes('--verify')) {
  const { count, error } = await supabase.from('custom_words')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw error
  const expected = FILES.reduce((n, f) => n + JSON.parse(readFileSync(f, 'utf8')).length, 0)
  console.log(`${count} rows stored for ${userId}; ${expected} words in the repo files`)
  process.exit(count === expected ? 0 : 1)
}

const rows = []
for (const file of FILES) {
  for (const w of JSON.parse(readFileSync(file, 'utf8'))) {
    // `id` and `listKey` are columns so a chapter can be fetched without
    // reading every payload; the word itself stays whole in `payload`, so a
    // new field on a word needs no migration here.
    rows.push({ user_id: userId, id: w.id, list_key: w.listKey, payload: w })
  }
}
console.log(`${rows.length} words from ${FILES.length} lists`)

const ids = new Set(rows.map(r => r.id))
if (ids.size !== rows.length) {
  console.error(`Ids are not unique across these lists (${rows.length - ids.size} collisions) — ` +
    'the table is keyed on (user_id, id), so uploading would silently drop some.')
  process.exit(1)
}

let written = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from('custom_words')
    .upsert(rows.slice(i, i + BATCH), { onConflict: 'user_id,id' })
  if (error) { console.error(`\nBatch at ${i} failed: ${error.message}`); process.exit(1) }
  written += Math.min(BATCH, rows.length - i)
  process.stdout.write(`\r  uploaded ${written}/${rows.length}`)
}
console.log(`\nDone. Re-run with --verify to confirm the row count.`)
