#!/usr/bin/env node
/**
 * Resolves a raw textbook vocabulary list to JMdict entry ids, emitting word
 * files that carry nothing but `{ id, listKey, jmdictId }` — glosses, readings
 * and display forms all come from the `dictionary` table at render time.
 *
 * The raw list's own English is used ONLY to disambiguate candidates at match
 * time and is never written out. That matters twice over: the app already
 * treats `dictionary` as the source of truth, and the raw lists are the
 * publisher's content while this repo is public.
 *
 * Refusing to guess is the whole design. A wrong jmdictId produces a card that
 * looks completely normal and silently teaches the wrong word, so anything not
 * confidently resolved lands in the report for a human instead of the JSON.
 *
 * Human decisions go in scripts/textbook-vocab-overrides.json, keyed
 * independently of the generated output, so re-running never discards review
 * work. An override value of null means "reviewed: JMdict has no entry".
 *
 * Run: node --env-file=.env scripts/resolve-textbook-vocab.mjs
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { displayFormOf } from '../src/lib/displayForm.js'
import { chooseBookForm, normalise } from '../src/lib/textbookForm.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.SUPABASE_SECRET_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or a Supabase key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const INPUT = 'scripts/vocab-input/genki 1-2 vocab.json'
const OVERRIDES = 'scripts/textbook-vocab-overrides.json'
const REPORT = 'scripts/vocab-input/genki-resolve-report.json'

// Lesson number → which book file and listKey it belongs to. Chapter ids must
// match src/data/textbooks.js, which is the source of truth for the roster.
const BOOKS = [
  { file: 'src/data/words/genki_1_vocab.json', prefix: 'genki-1', from: 1, to: 12 },
  { file: 'src/data/words/genki_2_vocab.json', prefix: 'genki-2', from: 13, to: 23 },
]

// Only kana_forms is GIN-indexed; overlapping kanji_forms seq-scans 217k rows
// and hits the statement timeout. Every candidate must contain the reading
// anyway, so the reading index reaches all of them.
const SELECT = 'id, primary_form, preferred_form, kanji_forms, kana_forms, gloss_en, common, senses, misc0:senses->0->misc'
const BATCH = 50

// --- gloss corroboration -------------------------------------------------
const STOP = new Set(['to', 'a', 'an', 'the', 'of', 'be', 'is', 'are', 'in', 'on', 'at',
  'for', 'and', 'or', 'esp', 'eg', 'ie', 'one', 's', 'it', 'that', 'this', 'with',
  'as', 'by', 'from', 'someone', 'something', 'etc'])

function toks(text, loose = false) {
  const words = (text ?? '')
    .toLowerCase()
    // Brackets are delimiters, not noise. A textbook writes a grammatical gloss
    // entirely inside them — "[counter for long objects]" — so deleting the
    // contents left nothing to match on and every counter fell back to the
    // entry's first sense: 本 the counter was glossed "book; volume; script".
    .replace(/[[\]]/gu, ' ')
    .split(/[^a-z]+/u)
    .filter(Boolean)
  return new Set(loose ? words : words.filter(w => w.length > 1 && !STOP.has(w)))
}

// How well a candidate's definition corroborates the supplied gloss:
//   frac — fraction of the supplied gloss's content words the candidate uses
//   pos  — mean position of those matches within the candidate's sense list
// JMdict orders senses by prominence, so position matters: "cold" is 風邪's
// first sense and 風's seventh, and fraction alone ties them at 1.0.
// Textbook glosses for the commonest words are exactly the ones strict
// tokenisation destroys — "I", "P.M.", "this one", "that ... (over there)" all
// reduce to nothing once single letters and stopwords go. Falling back to loose
// tokenisation (both sides, so they stay comparable) is what lets 私 beat 渡し
// and 此れ beat これ.
function glossDetail(gloss, row) {
  let loose = false
  let want = toks(gloss)
  if (!want.size) { loose = true; want = toks(gloss, true) }
  if (!want.size) return { frac: 0, pos: Infinity }

  const senses = (row.gloss_en ?? '').split(';')
  const firstAt = new Map()
  senses.forEach((sense, i) => {
    for (const w of toks(sense, loose)) if (!firstAt.has(w)) firstAt.set(w, i)
  })
  const hits = [...want].filter(w => firstAt.has(w)).map(w => firstAt.get(w))
  if (!hits.length) return { frac: 0, pos: Infinity }
  return { frac: hits.length / want.size, pos: hits.reduce((a, b) => a + b, 0) / hits.length }
}

// Which of an entry's senses the textbook is teaching. JMdict orders senses by
// general prominence, not by what a beginner course wants: あげる's "to give" is
// sense 5 of 上げる, behind "to raise; to elevate". Showing the first three
// glosses therefore answers a different question than the book asked.
function bestSense(gloss, row) {
  const senses = row?.senses
  if (!Array.isArray(senses) || senses.length < 2) return 0
  let want = toks(gloss)
  let loose = false
  if (!want.size) { loose = true; want = toks(gloss, true) }
  if (!want.size) return 0

  const score = i => {
    const have = toks((senses[i].gloss ?? []).join('; '), loose)
    let hits = 0
    for (const w of want) if (have.has(w)) hits++
    return hits / want.size
  }
  let best = 0
  for (let i = 1; i < senses.length; i++) if (score(i) > score(best)) best = i
  // Only move off the default when the match is real and strictly better.
  return score(best) > 0 && score(best) > score(0) ? best : 0
}

// `uk` says how a word is *written*, not which word it is. It is reported for
// context but deliberately never ranks — using it for identity picked 垂れ over
// 誰 and 彼の over あの.
const isUk = row => (row.misc0 ?? []).includes('uk')

// The supplied gloss is the primary signal — reading narrows the field, but
// meaning is what identifies the entry. Each later stage only breaks ties the
// one above left. Nothing arbitrary (form counts, id order) ever decides: かく
// scores 1.0 on both 書く and 描く, and letting "fewer kanji forms" settle that
// picked the wrong word silently.
function best(rows, spelling, gloss) {
  if (rows.length === 1) return { pick: rows[0], tied: rows, via: 'sole' }

  const frac = r => glossDetail(gloss, r).frac
  const near = r => -glossDetail(gloss, r).pos
  const spelt = r => (spelling && (r.kanji_forms ?? []).includes(spelling) ? 1 : 0)
  const common = r => (r.common ? 1 : 0)

  const narrow = stages => {
    let pool = rows
    for (const stage of stages) {
      const top = Math.max(...pool.map(stage))
      pool = pool.filter(r => stage(r) === top)
      if (pool.length === 1) break
    }
    return pool
  }

  // Sense-position and supplied-spelling are both real evidence, and neither
  // dominates: かえる "to go back" needs the spelling (帰る) to outrank position
  // (返る reads better positionally), while かぜ "cold" needs position (風邪) to
  // outrank a spelling the book got wrong (風). No single order gets both, so
  // run both and treat disagreement as what it is — a call for a human.
  const byPosition = narrow([frac, near, spelt, common])
  const bySpelling = narrow([frac, spelt, near, common])

  const settled = byPosition.length === 1 && bySpelling.length === 1
    && byPosition[0].id === bySpelling[0].id
  const pool = settled ? byPosition : [...new Map([...byPosition, ...bySpelling].map(r => [r.id, r])).values()]
  const corroborated = frac(pool[0]) > 0

  // With the meaning uninformative, a spelling that fits exactly one candidate
  // is decisive by itself — 午後 is the only かな-reading candidate written 午後,
  // whatever "P.M." does or doesn't share with "afternoon; p.m.".
  if (!corroborated) {
    const spelled = rows.filter(r => spelt(r) === 1)
    if (spelled.length === 1) return { pick: spelled[0], tied: rows, via: 'spelling-unique' }
  }

  if (!settled) {
    return { pick: null, tied: pool, via: corroborated ? 'evidence-conflict' : 'uncorroborated-tie' }
  }
  return {
    pick: pool[0],
    tied: rows,
    via: corroborated ? `gloss ${Math.round(frac(pool[0]) * 100)}%` : 'rank-uncorroborated',
  }
}

// --- fetch ---------------------------------------------------------------
async function fetchByReadings(readings) {
  const unique = [...new Set(readings)]
  const pool = new Map()
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data, error } = await supabase.from('dictionary').select(SELECT).overlaps('kana_forms', chunk)
    if (error) throw error
    for (const row of data ?? []) pool.set(row.id, row)
    process.stdout.write(`\r  fetched ${Math.min(i + BATCH, unique.length)}/${unique.length} readings`)
  }
  process.stdout.write('\n')
  return [...pool.values()]
}

// --- main ----------------------------------------------------------------
const raw = JSON.parse(readFileSync(INPUT, 'utf8'))
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {}

const entries = raw.map((row, i) => {
  const kana = normalise(row.Kana)
  const kanji = normalise(row.Kanji)
  const book = BOOKS.find(b => row.Lesson >= b.from && row.Lesson <= b.to)
  return {
    seq: i,
    lesson: row.Lesson,
    book,
    listKey: book ? `${book.prefix}-l${row.Lesson}` : null,
    srcKana: row.Kana,
    srcKanji: row.Kanji,
    gloss: row.Meaning,
    readings: kana.forms,
    derivedReadings: kana.derived,
    spelling: kanji.forms[0] ?? '',
    derivedSpelling: kanji.derived[0] ?? '',
    applied: [...new Set([...kana.applied.map(a => `kana:${a}`), ...kanji.applied.map(a => `kanji:${a}`)])],
  }
})

const noBook = entries.filter(e => !e.book)
if (noBook.length) console.warn(`WARNING: ${noBook.length} entries outside lessons 1-23`)

console.log(`Read ${entries.length} entries from ${INPUT}`)
const pool = await fetchByReadings(entries.flatMap(e => [...e.readings, ...e.derivedReadings]))
console.log(`  ${pool.length} candidate dictionary rows in pool`)

const byReading = new Map()
for (const row of pool) {
  for (const k of row.kana_forms ?? []) {
    if (!byReading.has(k)) byReading.set(k, [])
    byReading.get(k).push(row)
  }
}

const overrideKey = e => `${e.listKey}|${e.srcKanji}|${e.srcKana}`

for (const e of entries) {
  const key = overrideKey(e)
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    // An override is either a bare id or { id, note }. The note is the reason a
    // human chose it, and lives here rather than in a scratch script so the
    // decision survives with the decision.
    const decision = overrides[key]
    e.jmdictId = (decision && typeof decision === 'object') ? decision.id : decision
    // An override may also dictate how the card is written. This is the ONE
    // way a form JMdict does not list can reach a card, and it is deliberately
    // human-only: JMdict files lexemes, so a textbook's 歩いて or いらっしゃいます
    // has no entry and never will. Adding them to `dictionary` would either
    // invent ids that leak through jmdictId into SRS cards and entry links, or
    // redefine kana_forms — which the reading verification in
    // backfill-vocab-jmdict, resolveJmdictIds and the story lookup all depend
    // on — and both die on the next destructive re-import anyway.
    if (decision && typeof decision === 'object' && decision.form) {
      e.overrideForm = decision.form
      e.overrideReading = decision.reading ?? null
    }
    e.tier = e.jmdictId ? 'override' : 'override-none'
    continue
  }

  // Reading verification first: a row that cannot be read this way is the
  // wrong homograph however well its spelling matches.
  const lookup = forms => [...new Map(forms.flatMap(r => byReading.get(r) ?? []).map(r => [r.id, r])).values()]
  let verified = lookup(e.readings)
  let spelling = e.spelling
  if (!verified.length && e.derivedReadings.length) {
    verified = lookup(e.derivedReadings)
    if (verified.length) { spelling = e.derivedSpelling; e.applied.push('suru-stem') }
  }
  if (!verified.length) { e.tier = 'unmatched'; e.candidates = []; continue }

  // Spelling ranks but never filters: hard-filtering on the supplied kanji hid
  // 風邪 behind 風 for かぜ "cold" and produced a confident wrong answer.
  e.candidates = verified
  const chosen = best(verified, spelling, e.gloss)

  if (!chosen.pick) {
    e.tier = chosen.via === 'evidence-conflict' ? 'review-conflict' : 'review-uncorroborated'
    e.tied = chosen.tied
    continue
  }

  // The meaning chose an entry that cannot be written the way the book writes
  // it. Usually the supplied kanji is the wrong homograph, occasionally JMdict
  // splits where the book merges — either way a human decides.
  const forms = chosen.pick.kanji_forms ?? []
  if (spelling && forms.length && !forms.includes(spelling)) {
    e.tier = 'review-spelling-mismatch'
    e.pick = chosen.pick
    continue
  }

  if (chosen.via === 'rank-uncorroborated' && verified.length > 1) {
    e.tier = 'review-uncorroborated'
    e.pick = chosen.pick
    continue
  }

  e.jmdictId = chosen.pick.id
  e.pick = chosen.pick
  e.via = chosen.via
  e.tier = 'auto'
}

// --- emit ----------------------------------------------------------------
const rowById = new Map(pool.map(r => [r.id, r]))

// An override exists because the reading lookup failed, so its target is often
// absent from a pool built by querying readings — 授業中 is filed under
// じゅぎょうちゅう, never the book's じゅぎょうちゅうに. Those rows have to be
// fetched by id, or every override silently skips the display-form work and
// renders the dictionary's own spelling.
const missingIds = [...new Set(entries
  .filter(e => e.jmdictId && !rowById.has(e.jmdictId))
  .map(e => e.jmdictId))]
for (let i = 0; i < missingIds.length; i += BATCH) {
  const { data, error } = await supabase.from('dictionary').select(SELECT).in('id', missingIds.slice(i, i + BATCH))
  if (error) throw error
  for (const row of data ?? []) rowById.set(row.id, row)
}
if (missingIds.length) console.log(`  fetched ${missingIds.length} override targets absent from the reading pool`)
const resolved = entries.filter(e => e.jmdictId)
const seen = new Map()
const collapsed = []
for (const book of BOOKS) {
  const rows = []
  const counters = {}
  for (const e of resolved) {
    if (e.book !== book) continue
    // A textbook lists a word and its inflections as separate entries — Genki
    // has 知る, 知っています and 知りません in lesson 7 — and they resolve to one
    // JMdict entry, so only one card can exist. Skipping the inflected ones is
    // right (the base word is already in that lesson, and what the extra
    // entries teach is conjugation, which is grammar rather than vocabulary),
    // but it is a deliberate outcome and gets its own tier rather than being
    // quietly absorbed by the write loop.
    const dupKey = `${e.listKey}|${e.jmdictId}`
    if (seen.has(dupKey)) {
      e.tier = 'skipped-inflection'
      e.collapsedInto = seen.get(dupKey)
      collapsed.push({ kept: seen.get(dupKey), lost: e })
      continue
    }
    seen.set(dupKey, e)
    counters[e.listKey] = (counters[e.listKey] ?? 0) + 1

    // An overridden entry never went through the matcher, so it has no `pick`;
    // its chosen row still has to be looked up to know what will render.
    const entry = e.pick ?? rowById.get(e.jmdictId)
    const shown = entry ? displayFormOf(entry) : null
    // The normalised spelling, so a stripped 〜 or （な） is not mistaken for
    // the book and the dictionary disagreeing about the word.
    const bookForm = e.spelling || e.readings[0]

    const row = {
      id: `${e.listKey}-${String(counters[e.listKey]).padStart(3, '0')}`,
      listKey: e.listKey,
      jmdictId: e.jmdictId,
    }

    if (e.overrideForm) {
      row.kanji = e.overrideForm
      if (e.overrideReading) row.kana = e.overrideReading
    } else {
      // The rules for which form a card shows are shared with every other
      // textbook importer — see src/lib/textbookForm.js.
      Object.assign(row, chooseBookForm({
        entry,
        bookForm,
        rawBook: e.srcKanji?.trim() || e.srcKana?.trim() || '',
        stem: e.derivedSpelling || e.derivedReadings?.[0],
      }))
    }

    const sense = bestSense(e.gloss, entry)
    if (sense > 0) {
      row.sense = sense
      // Narrowing the gloss changes what the card teaches, so it is reviewable
      // like any other decision rather than applied invisibly.
      e.senseGloss = (entry.senses?.[sense]?.gloss ?? []).join('; ')
    }
    // What the card will actually render, for the audit — which otherwise
    // reports the dictionary's form and misses that the book's was kept.
    const rendered = (row.kanji ?? shown) + (row.suru ? 'する' : '')
    e.renders = row.mark ? row.mark.replace('{}', rendered) : rendered
    rows.push(row)
  }
  writeFileSync(book.file, `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`Wrote ${rows.length} entries → ${book.file}`)
}

// Counted after the write loop, so a tier means the outcome an entry actually
// reached. Tallying before it let 'auto' include entries that produced no card.
const tiers = {}
for (const e of entries) tiers[e.tier] = (tiers[e.tier] ?? 0) + 1

const needsReview = entries.filter(e => e.tier.startsWith('review') || e.tier === 'unmatched')
writeFileSync(REPORT, `${JSON.stringify({
  generated: new Date().toISOString(),
  input: INPUT,
  totals: tiers,
  review: needsReview.map(e => ({
    overrideKey: overrideKey(e),
    lesson: e.lesson,
    kana: e.srcKana,
    kanji: e.srcKanji,
    gloss: e.gloss,
    tier: e.tier,
    normalised: e.applied,
    picked: e.pick && { id: e.pick.id, form: e.pick.primary_form, gloss: (e.pick.gloss_en ?? '').slice(0, 80) },
    suggested: e.suggest && { id: e.suggest.id, form: e.suggest.primary_form, gloss: (e.suggest.gloss_en ?? '').slice(0, 80) },
    candidates: (e.tied ?? e.candidates ?? []).slice(0, 6).map(r => ({
      id: r.id, form: r.primary_form, common: r.common, uk: isUk(r), gloss: (r.gloss_en ?? '').slice(0, 70),
    })),
  })),
  // Every auto-resolved entry, weakest corroboration first. Reviewing 1,000
  // ids in file order is hopeless and reviewing a random sample finds nothing;
  // the errors that survive are concentrated where the gloss agreed least, so
  // this is the list to read top-down until it stops being interesting.
  collapsed: collapsed.map(c => ({
    listKey: c.lost.listKey,
    jmdictId: c.lost.jmdictId,
    kept: { kana: c.kept.srcKana, kanji: c.kept.srcKanji, gloss: c.kept.gloss },
    lost: { kana: c.lost.srcKana, kanji: c.lost.srcKanji, gloss: c.lost.gloss },
  })),
  // Every entry that became a card, auto-matched or human-decided. Overrides
  // belong here too — they are the decisions most worth re-reading, and an
  // audit that omitted them would quietly under-report what needs review.
  audit: entries
    .filter(e => e.jmdictId && e.tier !== 'skipped-inflection')
    .map(e => ({
      tier: e.tier,
      confidence: e.pick ? Math.round(glossDetail(e.gloss, e.pick).frac * 100) : null,
      lesson: e.lesson,
      kana: e.srcKana,
      kanji: e.srcKanji,
      gloss: e.gloss,
      via: e.via,
      candidates: (e.candidates ?? []).length,
      id: e.jmdictId,
      shows: e.renders ?? displayFormOf(e.pick ?? rowById.get(e.jmdictId)),
      dictGloss: ((e.pick ?? rowById.get(e.jmdictId))?.gloss_en ?? '').slice(0, 70),
      senseGloss: e.senseGloss ?? null,
    }))
    .sort((a, b) => (a.confidence ?? -1) - (b.confidence ?? -1) || b.candidates - a.candidates),
}, null, 2)}\n`)

console.log('\nTiers:')
for (const [k, v] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k}`)
}
console.log(`\n${needsReview.length} entries need review → ${REPORT}`)
if (collapsed.length) {
  console.log(`${collapsed.length} inflected entries skipped — their lesson already teaches the same word (see "collapsed" in the report)`)
}

// The three outcomes must account for every input row. A mismatch means an
// entry reached no tier at all, which nothing else would surface.
const cards = [...seen.values()].length
const accounted = cards + collapsed.length + (tiers.unmatched ?? 0)
  + (tiers['override-none'] ?? 0)
  + needsReview.filter(e => e.tier !== 'unmatched').length
if (accounted !== entries.length) {
  console.warn(`WARNING: ${accounted} entries accounted for, ${entries.length} read`)
}
