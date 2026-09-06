import { getTextbook } from '../data/textbooks.js'
import { WORD_DATA } from '../data/wordData.js'

// Fabricated learner shared by the #/dev/home-flow and #/dev/textbook-flow
// benches: Genki 1, three lessons drilled and sent, four SRS decks. Word
// counts are the real bundled ones so the numbers on screen are the numbers
// a real Genki 1 learner would see.

export const BOOK_ID = 'genki-1'
export const DAILY_NEW = 10
export const DRILLED_AT_START = 3

const WORD_COUNT_BY_LIST = WORD_DATA.reduce((map, w) => {
  if (!w.isSentenceVocab) map[w.listKey] = (map[w.listKey] ?? 0) + 1
  return map
}, {})
export const wordCountFor = id => WORD_COUNT_BY_LIST[id] ?? 0

export const INITIAL_DECKS = [
  { id: 'genki-1', name: 'Genki 1', source: 'imported', active: true, due: 12, newAvailable: 40, dist: { new: 40, learning: 31, young: 60, mature: 25, relearning: 0 } },
  { id: 'core2000', name: 'Core 2000', source: 'bundled', active: true, due: 9, newAvailable: 1500, dist: { new: 1500, learning: 80, young: 220, mature: 207, relearning: 0 } },
  { id: 'immersion-words', name: 'Immersion words', source: 'imported', active: false, due: 4, newAvailable: 10, dist: { new: 10, learning: 12, young: 15, mature: 5, relearning: 0 } },
  { id: 'story-words', name: 'Story words', source: 'imported', active: true, due: 0, newAvailable: 18, dist: { new: 18, learning: 0, young: 0, mature: 0, relearning: 0 } },
]

export function initialProgress() {
  const book = getTextbook(BOOK_ID)
  const sublists = {}
  for (const ch of book.chapters.slice(0, DRILLED_AT_START)) {
    sublists[ch.id] = { 'kanji-front': { lastReviewed: '2026-09-03T00:00:00Z', correct: 40, total: 48 } }
  }
  return { textbook: { id: BOOK_ID, currentChapterId: book.chapters[DRILLED_AT_START].id }, sublists }
}

export function initialSent() {
  return new Set(getTextbook(BOOK_ID).chapters.slice(0, DRILLED_AT_START).map(ch => ch.id))
}

export const deckTotal = d => Object.values(d.dist).reduce((a, b) => a + b, 0)

// Same maths as srs.js's getGlobalStats: a quarter-minute a card, new
// capped at the daily allowance.
export function summariseDecks(decks) {
  const active = decks.filter(d => d.active)
  const due = active.reduce((s, d) => s + d.due, 0)
  const newAvailable = active.reduce((s, d) => s + d.newAvailable, 0)
  const newToday = Math.min(DAILY_NEW, newAvailable)
  return {
    due,
    newToday,
    newWaiting: newAvailable - newToday,
    totalCards: decks.reduce((s, d) => s + deckTotal(d), 0),
    activeDecks: active.length,
    canStart: due + newToday > 0,
    estimatedMinutes: Math.ceil((due + newToday) * 0.25),
  }
}

// Adds a chapter's words to the deck named after its book, creating it on
// first send.
export function addChapterToDecks(decks, book, count) {
  const existing = decks.find(d => d.id === book.id)
  if (existing) {
    return decks.map(d => d.id === book.id ? { ...d, newAvailable: d.newAvailable + count, dist: { ...d.dist, new: d.dist.new + count } } : d)
  }
  return [...decks, { id: book.id, name: book.title, source: 'imported', active: true, due: 0, newAvailable: count, dist: { new: count, learning: 0, young: 0, mature: 0, relearning: 0 } }]
}
