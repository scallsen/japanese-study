#!/usr/bin/env node
/**
 * Builds "Nihongo So-Matome N3 Kanji" from the three personal course lists.
 *
 * Those lists are a class's own re-chunking of the book: three volumes (I-3,
 * I-4, I-5), each cut into 4 weeks × 3 days. The book itself is 6 weeks × 7
 * days, where day 7 is review and introduces nothing — so 36 vocabulary days,
 * exactly the number of lists the course produced. Working through them in
 * order and re-cutting 36 into 6 × 6 restores the book's own structure.
 *
 * This is a TRANSFORM, not a re-match. Every word already carries a jmdictId
 * from backfill-vocab-jmdict.mjs, reading-verified at the time, and re-running
 * the matcher against entries whose English glosses are mostly absent would be
 * strictly worse. Only the display fields are recomputed, with the same rules
 * every textbook importer uses (src/lib/textbookForm.js).
 *
 * The course lists themselves are left untouched: their sentences, review flags
 * and sentence-vocabulary are the learner's own and stay with them.
 *
 * Run: node --env-file=.env scripts/migrate-somatome-kanji.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { chooseBookForm, normalise } from '../src/lib/textbookForm.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.SUPABASE_SECRET_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SOURCES = [
  'src/data/words/nsm_n3_vocab.json',
  'src/data/words/nsm_n3_i4_vocab.json',
  'src/data/words/nsm_n3_i5_vocab.json',
]
const OUT = 'src/data/words/nsm_n3_kanji_vocab.json'
const PREFIX = 'nsm-n3-kanji'
const WEEKS = 6
const DAYS = 6

const dayIndex = key => {
  const w = Number(key.match(/w(\d+)/)[1])
  const d = Number(key.match(/d(\d+)/)[1])
  return (w - 1) * 3 + (d - 1)
}

const lists = []
for (const file of SOURCES) {
  const words = JSON.parse(readFileSync(file, 'utf8'))
  const keys = [...new Set(words.map(w => w.listKey))].sort((a, b) => dayIndex(a) - dayIndex(b))
  for (const key of keys) lists.push({ key, words: words.filter(w => w.listKey === key) })
}

if (lists.length !== WEEKS * DAYS) {
  console.error(`Expected ${WEEKS * DAYS} lists, found ${lists.length} — the re-cut is only valid if these line up.`)
  process.exit(1)
}

const ids = [...new Set(lists.flatMap(l => l.words.map(w => w.jmdictId)).filter(Boolean))]
const rows = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await supabase.from('dictionary')
    .select('id, primary_form, preferred_form, kanji_forms, kana_forms, misc0:senses->0->misc')
    .in('id', ids.slice(i, i + 200))
  if (error) throw error
  for (const r of data ?? []) rows.set(r.id, r)
}
console.log(`${ids.length} distinct entries, ${rows.size} resolved`)

// The original backfill matched the form as printed, so anything the book
// decorates — 無理（な）, ～号車, 正確（な） — never matched and was left unlinked.
// Normalising first makes them matchable. Conservative on purpose: the reading
// must be one the entry lists, and the spelling too unless the word is written
// in kana, since these lists have no English gloss to break a tie with.
const unmatched = lists.flatMap(l => l.words).filter(w => !w.jmdictId)
const readings = [...new Set(unmatched.map(w => normalise(w.kana || '').forms[0]).filter(Boolean))]
const pool = []
for (let i = 0; i < readings.length; i += 50) {
  const { data, error } = await supabase.from('dictionary')
    .select('id, primary_form, preferred_form, kanji_forms, kana_forms, common, misc0:senses->0->misc')
    .overlaps('kana_forms', readings.slice(i, i + 50))
  if (error) throw error
  pool.push(...(data ?? []))
}
const recovered = new Map()
for (const w of unmatched) {
  const reading = normalise(w.kana || '').forms[0]
  const spelling = normalise(w.kanji || '').forms[0]
  if (!reading) continue
  let cands = pool.filter(r => (r.kana_forms ?? []).includes(reading))
  const kanaOnly = !spelling || spelling === reading
  if (!kanaOnly) cands = cands.filter(r => (r.kanji_forms ?? []).includes(spelling))
  const common = cands.filter(r => r.common)
  const pick = common.length === 1 ? common[0] : cands.length === 1 ? cands[0] : null
  if (pick) { recovered.set(w.id, pick); rows.set(pick.id, pick) }
}
console.log(`recovered ${recovered.size} of ${unmatched.length} previously unlinked words`)

const out = []
let kept = 0, unlinked = 0
lists.forEach(({ words }, i) => {
  const listKey = `${PREFIX}-w${Math.floor(i / DAYS) + 1}d${(i % DAYS) + 1}`
  words.forEach((w, n) => {
    const row = { id: `${listKey}-${String(n + 1).padStart(3, '0')}`, listKey }
    const found = recovered.get(w.id)
    const jmdictId = w.jmdictId ?? found?.id
    const entry = jmdictId ? rows.get(jmdictId) : null
    if (entry) {
      row.jmdictId = jmdictId
      const rawBook = (w.kanji || w.kana || '').trim()
      const norm = normalise(w.kanji || '')
      const kana = normalise(w.kana || '')
      const display = chooseBookForm({
        entry,
        bookForm: norm.forms[0] || kana.forms[0],
        rawBook,
        stem: norm.derived[0] || kana.derived[0],
      })
      Object.assign(row, display)
      if (display.kanji) kept++
    } else {
      // No dictionary link, so nothing to resolve from: an id-only card would
      // render blank. These keep just enough of their own text to be a card.
      unlinked++
      if (w.kanji) row.kanji = w.kanji
      if (w.kana) row.kana = w.kana
      if (w.english) row.english = w.english
    }
    out.push(row)
  })
})

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
console.log(`Wrote ${out.length} words → ${OUT}`)
console.log(`  ${out.length - unlinked} linked to a dictionary entry, ${unlinked} carry their own text`)
console.log(`  ${kept} keep the book's own spelling`)
console.log(`  ${out.filter(r => r.mark).length} carry a decoration template`)
console.log(`  ${out.filter(r => r.modified).length} cannot be written as the book writes them`)
