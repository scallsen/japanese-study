import { State } from 'ts-fsrs'
import { WORD_DATA } from '../data/wordData.js'
import { WORD_SOURCES } from '../data/wordLists.js'

export const MATURITY_LEVELS = [
  { id: 'all', label: 'All cards' },
  { id: 'seen', label: 'Seen at least once' },
  { id: 'graduated', label: 'Graduated only' },
]

export const GRAMMAR_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

function listKeysForVocabSource(sourceId) {
  const source = WORD_SOURCES.find(s => s.id === sourceId)
  if (source) return source.lists ? source.lists.map(l => l.id) : [source.id]
  return [sourceId]
}

function vocabWords(sourceId, wordData) {
  const keys = new Set(listKeysForVocabSource(sourceId))
  return wordData
    .filter(w => keys.has(w.listKey))
    .map(w => ({ term: w.kanji, reading: w.kana !== w.kanji ? w.kana : null, meaning: w.english }))
}

function matchesMaturity(card, maturity, minStabilityDays) {
  if (maturity === 'seen' && card.state === State.New) return false
  if (maturity === 'graduated' && card.state !== State.Review) return false
  if (minStabilityDays > 0 && (card.stability ?? 0) < minStabilityDays) return false
  return true
}

function srsWords(deckId, cards, maturity, minStabilityDays) {
  return cards
    .filter(c => c.deckId === deckId && !c.suspended)
    .filter(c => matchesMaturity(c, maturity, minStabilityDays))
    .filter(c => c.front && c.back)
    .map(c => ({ term: c.front, reading: c.kana && c.kana !== c.front ? c.kana : null, meaning: c.back }))
}

function formatWordLine({ term, reading, meaning }) {
  return reading ? `${term} (${reading}) — ${meaning}` : `${term} — ${meaning}`
}

// Builds a compact, LLM-ready description of what the learner currently knows.
// Pure data retrieval + formatting — no LLM calls, no UI coupling.
//
// sourceType: 'vocab-list' — sourceId is a WORD_SOURCES source id (all its
//   sublists) or a single listKey. Reads bundled word JSON.
// sourceType: 'srs-deck' — sourceId is a deckId. Caller must pass
//   options.cards: an array of RESOLVED cards (content fields present —
//   run bundled cards through resolveCard first, since scheduling-only
//   card state has no front/back).
//
// options:
//   cards            resolved SRS cards (required for 'srs-deck')
//   maturity         'all' | 'seen' | 'graduated' (srs-deck only, default 'all')
//   minStabilityDays extra FSRS stability floor in days (srs-deck only, default 0)
//   grammarLevel     'N5'..'N1' | null — appends a grammar directive line (default 'N3')
//   maxWords         cap the list length (default no cap)
//   wordData         override the bundled word data (tests)
//
// Returns { text, wordCount, words }.
export function buildLearnerContext(sourceType, sourceId, options = {}) {
  const {
    cards = [],
    maturity = 'all',
    minStabilityDays = 0,
    grammarLevel = 'N3',
    maxWords = Infinity,
    wordData = WORD_DATA,
  } = options

  let words
  if (sourceType === 'vocab-list') {
    words = vocabWords(sourceId, wordData)
  } else if (sourceType === 'srs-deck') {
    words = srsWords(sourceId, cards, maturity, minStabilityDays)
  } else {
    throw new Error(`Unknown sourceType: ${sourceType}`)
  }

  if (words.length > maxWords) words = words.slice(0, maxWords)

  const lines = [
    `The learner knows the following Japanese vocabulary (${words.length} words):`,
    ...words.map(formatWordLine),
  ]
  if (grammarLevel) {
    lines.push(`The learner understands Japanese grammar up to JLPT ${grammarLevel} level.`)
  }

  return { text: lines.join('\n'), wordCount: words.length, words }
}
