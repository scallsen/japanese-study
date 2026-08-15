#!/usr/bin/env node
/**
 * Validates the Vocab Drill word-list JSON invariant: every entry must be
 * either dictionary-linked (jmdictId set — kanji/kana/english are then
 * optional overrides, filled in from `dictionary` at render time) or fully
 * custom (jmdictId absent — kanji, kana, and english are all required, since
 * nothing else can supply them). See CLAUDE.md's word data format section.
 *
 * Also checks `id` uniqueness within each file (a duplicate would silently
 * shadow another entry wherever word data is looked up by id).
 *
 * Run: node scripts/validate-word-lists.mjs
 * No Supabase/network access needed — pure local JSON validation.
 */

import { readFileSync } from 'fs'

const TARGETS = [
  'src/data/words/nsm_n3_vocab.json',
  'src/data/words/nsm_n3_i4_vocab.json',
  'src/data/words/nsm_n3_i5_vocab.json',
  'src/data/words/nsm_n2_a1_vocab.json',
]

function validateFile(path) {
  const entries = JSON.parse(readFileSync(path, 'utf8'))
  const problems = []
  const seenIds = new Set()

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      problems.push(`  ${entry.id}: duplicate id within this file`)
    }
    seenIds.add(entry.id)

    if (!entry.jmdictId && !(entry.kanji && entry.kana && entry.english)) {
      const missing = ['kanji', 'kana', 'english'].filter(f => !entry[f])
      problems.push(`  ${entry.id}: no jmdictId, missing required field(s): ${missing.join(', ')}`)
    }
  }

  return { path, total: entries.length, problems }
}

function main() {
  let anyProblems = false
  for (const path of TARGETS) {
    const { total, problems } = validateFile(path)
    if (problems.length === 0) {
      console.log(`${path}: OK (${total} entries)`)
    } else {
      anyProblems = true
      console.log(`${path}: ${problems.length} problem(s) out of ${total} entries`)
      for (const p of problems) console.log(p)
    }
  }

  if (anyProblems) {
    console.error('\nValidation failed.')
    process.exit(1)
  }
  console.log('\nAll word lists valid.')
}

main()
