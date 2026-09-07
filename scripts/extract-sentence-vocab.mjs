#!/usr/bin/env node
/**
 * Mines the custom `sentence` field on every Vocab Drill word (src/data/words/*.json)
 * for incidental vocabulary beyond the headword itself, matches each candidate word
 * against the Supabase `dictionary` table, and writes the result to
 * src/data/words/sentence-vocab.json as a new opt-in "sentence review words" pool
 * (see the "Include sentence review words" setting in VocabPage.jsx).
 *
 * Tokenization mirrors supabase/functions/word-import/index.ts's extractCandidateWords.
 * Dictionary matching for a kanji-bearing base is an exact primary_form match only
 * (no reading to verify a kana_forms fallback against). A pure-kana base (no kanji
 * at all — the common case, since Kuromoji's basic_form is often itself kana) goes
 * through a dedicated homophone resolver below: if every dictionary row sharing that
 * kana reading agrees, or exactly one of several is flagged `common`, that row wins;
 * otherwise the candidate is left unmatched rather than guessed at.
 *
 * (dictionaryLookup.js's own resolveJmdictMatches was tried first for this — its
 * pure-kana guard prefers whichever homophone has zero kanji_forms, which picks the
 * *rarer* sense for words like なる/こと/ほう, whose common everyday sense (成る/事/方)
 * happens to have kanji forms recorded while an obscure interjection/particle entry
 * sharing the same kana doesn't. The `common` flag is the more reliable signal here.)
 *
 * A short stoplist also drops grammatical morphemes (passive/causative auxiliaries,
 * honorific prefixes) that occasionally survive Kuromoji's own particle/aux-verb
 * POS filter — see GRAMMATICAL_STOPLIST below.
 *
 * A candidate is dropped if it resolves to the same jmdictId as the headword whose
 * sentence it came from (redundant), or to a jmdictId that's already a headword
 * within the same listKey (avoids duplicate content in one list). The same word
 * found in multiple sentences within one list is deduped to a single entry, keeping
 * the first sentence encountered and recording every contributing headword id.
 *
 * Destructive full-refresh (like scripts/import-tanaka.mjs) — regenerates the whole
 * output file from the current source sentences every run.
 *
 * Run: node --env-file=.env scripts/extract-sentence-vocab.mjs
 * Writes unmatched candidates to extract-sentence-vocab-report.json for manual
 * review; does not fail the run.
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import kuromoji from 'kuromoji'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolveJmdictMatches, matchKey } from '../src/lib/dictionaryLookup.js'

const SELECT = 'id, primary_form, kana_forms, gloss_en, pos, common'

const _require = createRequire(import.meta.url)
const KUROMOJI_DICT_PATH = join(dirname(_require.resolve('kuromoji/package.json')), 'dict')

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const SOURCE_FILES = [
  'src/data/words/nsm_n3_vocab.json',
  'src/data/words/nsm_n3_i4_vocab.json',
  'src/data/words/nsm_n3_i5_vocab.json',
  'src/data/words/nsm_n2_a1_vocab.json',
]

// The course word lists moved to per-account storage, so these paths may
// no longer exist. Skip what is absent rather than failing to start.
const SOURCE_FILES_PRESENT = SOURCE_FILES.filter(x => existsSync(x))
if (SOURCE_FILES_PRESENT.length < SOURCE_FILES.length) {
  console.warn(`Skipping ${SOURCE_FILES.length - SOURCE_FILES_PRESENT.length} word list(s) that are no longer in this repo`)
}

const OUTPUT_FILE = 'src/data/words/sentence-vocab.json'
const REPORT_FILE = 'extract-sentence-vocab-report.json'

const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])
const HAS_JAPANESE = /[一-龯㐀-䶿々ぁ-んァ-ヶー]/
const IS_PURE_KANA = /^[ぁ-んァ-ヶー]+$/

// Passive/causative/desiderative/hearsay auxiliaries and honorific prefixes —
// grammatical function words, not vocabulary, that sometimes survive Kuromoji's
// PARTICLE_POS filter because this IPADIC build doesn't tag them 助動詞/助詞.
const GRAMMATICAL_STOPLIST = new Set(['れる', 'られる', 'せる', 'させる', 'たい', 'そう', 'よう', 'べき', 'がる', 'お', 'ご'])

// Resolves pure-kana candidate bases against every dictionary row sharing that
// exact kana reading. Unambiguous (a single row) → use it. Ambiguous but exactly
// one candidate is flagged `common` → prefer it (a reliable everyday-usage signal,
// unlike kanji_forms-emptiness — see file header comment). Otherwise unmatched.
async function resolvePureKanaBases(client, bases, batchSize = 50) {
  const byKana = new Map()
  for (let i = 0; i < bases.length; i += batchSize) {
    const chunk = bases.slice(i, i + batchSize)
    const { data, error } = await client.from('dictionary').select(SELECT).overlaps('kana_forms', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      for (const kana of row.kana_forms) {
        if (!chunk.includes(kana)) continue
        if (!byKana.has(kana)) byKana.set(kana, [])
        byKana.get(kana).push(row)
      }
    }
  }

  const matches = new Map()
  for (const base of bases) {
    const candidates = byKana.get(base) ?? []
    if (candidates.length === 1) {
      matches.set(base, candidates[0])
    } else if (candidates.length > 1) {
      const commonOnes = candidates.filter(r => r.common)
      matches.set(base, commonOnes.length === 1 ? commonOnes[0] : null)
    } else {
      matches.set(base, null)
    }
  }
  return matches
}

function buildTokenizerInstance() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, t) => {
      err ? reject(err) : resolve(t)
    })
  })
}

// Tokenizes a sentence into unique content-word base forms (dictionary lookup keys).
function extractCandidateBases(tokenizer, text) {
  const seen = new Set()
  for (const tok of tokenizer.tokenize(text)) {
    if (PARTICLE_POS.has(tok.pos)) continue
    const surface = tok.surface_form.trim()
    if (!surface || !HAS_JAPANESE.test(surface)) continue
    const base = tok.basic_form && tok.basic_form !== '*' ? tok.basic_form : surface
    if (GRAMMATICAL_STOPLIST.has(base)) continue
    seen.add(base)
  }
  return [...seen]
}

async function main() {
  console.log('Building Kuromoji tokenizer...')
  const tokenizer = await buildTokenizerInstance()
  console.log('Tokenizer ready.')

  const filesEntries = SOURCE_FILES_PRESENT.map(path => ({ path, entries: JSON.parse(readFileSync(path, 'utf8')) }))

  // Existing headwords per listKey, across every source file — used to drop a
  // candidate that's already being drilled directly in the same list.
  const headwordsByListKey = new Map()
  for (const { entries } of filesEntries) {
    for (const entry of entries) {
      if (!entry.jmdictId) continue
      if (!headwordsByListKey.has(entry.listKey)) headwordsByListKey.set(entry.listKey, new Set())
      headwordsByListKey.get(entry.listKey).add(entry.jmdictId)
    }
  }

  // Pass 1: tokenize every sentence, collect candidates alongside their origin.
  const candidates = []
  const allBases = new Set()
  for (const { path, entries } of filesEntries) {
    let sentenceCount = 0
    for (const entry of entries) {
      if (!entry.sentence) continue
      sentenceCount++
      const bases = extractCandidateBases(tokenizer, entry.sentence)
      for (const base of bases) {
        allBases.add(base)
        candidates.push({ base, sentence: entry.sentence, sourceId: entry.id, listKey: entry.listKey, ownJmdictId: entry.jmdictId ?? null })
      }
    }
    console.log(`${path}: ${sentenceCount} sentences tokenized`)
  }

  console.log(`\nResolving ${allBases.size} unique candidate words against the dictionary...`)
  const [pureKanaBases, kanjiBases] = [[...allBases].filter(b => IS_PURE_KANA.test(b)), [...allBases].filter(b => !IS_PURE_KANA.test(b))]

  const kanaMatches = await resolvePureKanaBases(supabase, pureKanaBases)
  // Kanji-bearing base: exact primary_form match only (kana:null skips the
  // kana_forms fallback entirely — no independent reading to verify it against).
  const kanjiMatchesByKey = await resolveJmdictMatches(supabase, kanjiBases.map(base => ({ form: base, kana: null })))

  const matches = new Map(kanaMatches)
  for (const base of kanjiBases) matches.set(base, kanjiMatchesByKey.get(matchKey(base, null)))

  // Pass 2: filter + dedupe by (listKey, jmdictId).
  const unmatchedReport = []
  let selfDropped = 0
  let duplicateHeadwordDropped = 0
  const derived = new Map() // key: `${listKey}::${jmdictId}` -> record

  for (const c of candidates) {
    const row = matches.get(c.base)
    if (!row) {
      unmatchedReport.push({ listKey: c.listKey, sourceId: c.sourceId, base: c.base, sentence: c.sentence })
      continue
    }
    if (c.ownJmdictId && row.id === c.ownJmdictId) { selfDropped++; continue }
    if (headwordsByListKey.get(c.listKey)?.has(row.id)) { duplicateHeadwordDropped++; continue }

    const key = `${c.listKey}::${row.id}`
    if (derived.has(key)) {
      const record = derived.get(key)
      if (!record.sourceWordIds.includes(c.sourceId)) record.sourceWordIds.push(c.sourceId)
    } else {
      derived.set(key, { jmdictId: row.id, listKey: c.listKey, isSentenceVocab: true, sentence: c.sentence, sourceWordIds: [c.sourceId] })
    }
  }

  // Assign stable sequential ids per listKey, in first-seen order.
  const counters = new Map()
  const output = []
  for (const record of derived.values()) {
    const n = (counters.get(record.listKey) ?? 0) + 1
    counters.set(record.listKey, n)
    output.push({
      id: `${record.listKey}-sv-${String(n).padStart(3, '0')}`,
      jmdictId: record.jmdictId,
      listKey: record.listKey,
      isSentenceVocab: true,
      sentence: record.sentence,
      sourceWordIds: record.sourceWordIds,
    })
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n')
  console.log(`\nWrote ${output.length} sentence-vocab entries to ${OUTPUT_FILE}`)
  console.log(`  ${selfDropped} dropped (matched the sentence's own headword)`)
  console.log(`  ${duplicateHeadwordDropped} dropped (already a headword in the same list)`)

  if (unmatchedReport.length) {
    writeFileSync(REPORT_FILE, JSON.stringify(unmatchedReport, null, 2) + '\n')
    console.log(`  ${unmatchedReport.length} candidates left unmatched — see ${REPORT_FILE} for manual review.`)
  } else {
    console.log('  All candidates matched.')
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
