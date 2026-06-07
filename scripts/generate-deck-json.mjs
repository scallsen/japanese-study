#!/usr/bin/env node
// Converts an Anki Core 2000 TSV export to a bundled deck JSON file.
// Usage: node scripts/generate-deck-json.mjs

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TSV_PATH = '/Users/simoncallsen/Desktop/Anki Export/Core 2000.txt'
const OUT_PATH = join(__dirname, '../src/modules/vocab-srs/decks/core2000.json')

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').trim()
}

function extractSound(field) {
  const m = (field || '').match(/\[sound:([^\]]+)\]/)
  return m ? m[1] : null
}

const tsv = readFileSync(TSV_PATH, 'utf8')
const cards = []

for (const line of tsv.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const cols = trimmed.split('\t')
  if (cols.length < 14) continue

  const noteId   = cols[0].trim()
  const front    = stripHtml(cols[1])
  const kana     = stripHtml(cols[3])
  const back     = stripHtml(cols[4])
  const wordAudio     = extractSound(cols[5])
  const sentence      = stripHtml(cols[11])
  const sentenceAudio = extractSound(cols[13])

  if (!front || !back) continue

  const card = { id: `anki-${noteId}`, front, back }
  if (kana && kana !== front) card.kana = kana
  if (wordAudio) card.wordAudio = wordAudio
  if (sentenceAudio) card.sentenceAudio = sentenceAudio
  if (sentence) card.sentence = sentence

  cards.push(card)
}

writeFileSync(OUT_PATH, JSON.stringify(cards, null, 2))
console.log(`Wrote ${cards.length} cards to ${OUT_PATH}`)
