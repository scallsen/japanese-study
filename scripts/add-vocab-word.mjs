#!/usr/bin/env node
/**
 * Minimal Vocab Drill authoring helper: given a bare word (kanji or kana)
 * and a target listKey, resolves it against the dictionary (reusing the
 * same reading-verified matcher scripts/backfill-vocab-jmdict.mjs uses) and
 * prints a ready-to-append JSON entry — jmdictId set, kanji/kana/english all
 * omitted since the dictionary supplies them at render time (per CLAUDE.md's
 * word data format invariant: jmdictId || (kanji && kana && english)).
 *
 * On no match, prints a clear message instead — that word needs to be added
 * by hand with kanji+kana+english, since nothing else can supply that
 * content for a word the dictionary doesn't recognize.
 *
 * This does not write to any file — it only prints a suggestion for you to
 * review and paste into the target src/data/words/*.json list yourself.
 *
 * Usage: node --env-file=.env scripts/add-vocab-word.mjs <word> <listKey> [idSuffix]
 *   <word>     kanji or kana form of the word to add
 *   <listKey>  target list (must match an existing WORD_SOURCES id/sublist)
 *   [idSuffix] optional — defaults to a slug of the matched word; the
 *              emitted id is "<listKey>-<idSuffix>"
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import { resolveJmdictMatch } from '../src/lib/dictionaryLookup.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const [, , word, listKey, idSuffixArg] = process.argv
if (!word || !listKey) {
  console.error('Usage: node scripts/add-vocab-word.mjs <word> <listKey> [idSuffix]')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const HAS_KANJI = /[一-鿿㐀-䶿]/

function slug(str) {
  return str.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 20) || 'word'
}

async function main() {
  // A kanji word is matched on primary_form alone — there's no separate
  // reading to verify against yet, so the human reviews the resolved
  // reading printed below before trusting it. A pure-kana word is matched
  // with kana === form, the same "already kana, no separate reading field"
  // convention used for Core 2000/keigo entries elsewhere (see
  // backfill-vocab-jmdict.mjs) — this is what lets the matcher fall through
  // to the kana_forms search and its homograph-disambiguation safety net
  // (e.g. する → 為る/刷る/掏る/剃る/擦る) instead of guessing.
  const row = HAS_KANJI.test(word)
    ? await resolveJmdictMatch(supabase, { form: word, kana: null })
    : await resolveJmdictMatch(supabase, { form: word, kana: word })

  if (!row) {
    console.log(`No dictionary match for "${word}".`)
    console.log('Add it by hand — this word needs to stay fully custom (kanji, kana, and english all required):')
    console.log(JSON.stringify({ id: `${listKey}-${slug(word)}`, kanji: word, kana: '', english: '', listKey }, null, 2))
    return
  }

  console.log(`Matched "${word}" -> ${row.primary_form} (${row.kana_forms?.[0] ?? '?'})${row.gloss_en ? ` — ${row.gloss_en.split('; ')[0]}` : ''}`)
  if (row.common !== true) {
    console.log('  Note: not flagged "common" in the dictionary — double check this is the word you meant.')
  }

  const idSuffix = idSuffixArg || slug(row.primary_form)
  const entry = { id: `${listKey}-${idSuffix}`, jmdictId: row.id, listKey }
  console.log('\nReady to append (review the id, then paste into the target file):')
  console.log(JSON.stringify(entry, null, 2))
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
