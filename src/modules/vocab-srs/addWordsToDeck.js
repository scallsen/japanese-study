import { createCard } from './srs.js'
import { ensureDeck } from './deckUtils.js'
import { cardFormOf } from '../../lib/displayForm.js'
import { cardGloss } from '../../utils/dictionaryEntryLookup.js'

const EMPTY_PROGRESS = { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }

// Builds new card entries for words not already present (by front form) in
// the target deck. Shared by VocabPage's done-screen "Add to SRS" and the
// textbook advance gate (Dashboard + the vocab training page), which both
// turn a handful of drill words into cards and would otherwise duplicate the
// dedupe/creation logic.
export function buildCardsForWords(words, targetDeckId, existingCardsObj, dictEntries, senseGlosses) {
  const existingFronts = new Set(
    Object.values(existingCardsObj)
      .filter(c => c.deckId === targetDeckId)
      .map(c => c.front)
  )
  const newCards = {}
  const newCardIds = []
  words.forEach((word, i) => {
    const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
    const front = cardFormOf(word, dictEntry).form ?? word.kana
    if (existingFronts.has(front)) return
    existingFronts.add(front)
    const cardId = `${targetDeckId}-${Date.now()}-${i}`
    const kana = word.kana ?? dictEntry?.kana_forms?.[0]
    const english = word.english ?? cardGloss(word, dictEntry, senseGlosses)
    const extras = {}
    if (kana) extras.kana = kana
    if (word.sentence) extras.sentence = word.sentence
    if (word.jmdictId) extras.jmdictId = word.jmdictId
    newCards[cardId] = createCard(front, english, cardId, targetDeckId, extras)
    newCardIds.push(cardId)
  })
  return { newCards, newCardIds }
}

// Full "add these words to a deck" step: ensures the deck exists (creating it
// with `deckName` the first time — a caller adding to a deck that might not
// exist yet, like the per-textbook deck the advance gate writes to), builds
// the new cards, and returns the updated progress payload ready to save.
export function addWordsToSrs(srsData, words, deckId, deckName, dictEntries, senseGlosses) {
  const current = srsData ?? EMPTY_PROGRESS
  const decks = ensureDeck(current.decks, deckId, current.decks[deckId]?.name ?? deckName)
  const { newCards, newCardIds } = buildCardsForWords(words, deckId, current.cards, dictEntries, senseGlosses)
  const resolvedDeckName = decks[deckId]?.name ?? deckName
  const data = newCardIds.length > 0
    ? { ...current, decks, cards: { ...current.cards, ...newCards } }
    : { ...current, decks }
  return { data, count: newCardIds.length, cardIds: newCardIds, deckName: resolvedDeckName }
}

// The one deck a textbook's chapters send words to by default — the advance
// gate and the chapter word list both need the same id/name so repeated use
// lands in one place instead of a fresh deck per chapter.
export function textbookDeck(textbook) {
  return { deckId: `textbook-${textbook.id}`, deckName: textbook.title }
}
