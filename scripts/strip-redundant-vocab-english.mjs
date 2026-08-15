#!/usr/bin/env node
/**
 * One-off migration: removes the static `english` field from every Vocab
 * Drill word-list entry that already carries a `jmdictId`. Safe because the
 * dictionary already wins over `english` at render time wherever it's
 * consulted (VocabCard, VocabPage's GlanceScreen/DoneScreen/handleAddToSrs)
 * — this only deletes now-provably-dead duplicate text. Entries with no
 * jmdictId are left untouched (english stays required for those).
 *
 * Run: node scripts/strip-redundant-vocab-english.mjs
 * No Supabase/network access needed — pure local JSON edit.
 */

import { readFileSync, writeFileSync } from 'fs'

const TARGETS = [
  'src/data/words/nsm_n3_vocab.json',
  'src/data/words/nsm_n3_i4_vocab.json',
  'src/data/words/nsm_n3_i5_vocab.json',
  'src/data/words/nsm_n2_a1_vocab.json',
]

function processFile(path) {
  const entries = JSON.parse(readFileSync(path, 'utf8'))
  let stripped = 0
  for (const entry of entries) {
    if (entry.jmdictId && 'english' in entry) {
      delete entry.english
      stripped++
    }
  }
  if (stripped > 0) {
    writeFileSync(path, JSON.stringify(entries, null, 2) + '\n')
  }
  console.log(`${path}: stripped english from ${stripped}/${entries.length} entries`)
}

for (const path of TARGETS) processFile(path)
