import { createEmptyCard } from 'ts-fsrs'
import CORE3K from './decks/core3k.json'
import KEIGO from './decks/keigo.json'

const DECK_WORDS = {
  'core3k': CORE3K,
  'keigo': KEIGO,
}

function freshBundledDecks(now) {
  return {
    'core3k': { id: 'core3k', name: 'Core 3K', source: 'bundled', active: true, addedAt: now },
    'keigo':  { id: 'keigo',  name: 'Keigo',   source: 'bundled', active: false, addedAt: now },
  }
}

// Converts stored progress to the current shape.
// Old shape: { cards: Card[], lastSession, totalReviews }
// New shape: { decks: {}, cards: {}, lastSession, totalReviews }
export function migrateProgress(raw) {
  const now = Date.now()

  // Fresh install
  if (!raw) {
    return { decks: freshBundledDecks(now), cards: {}, lastSession: null, totalReviews: 0 }
  }

  // Already new shape — ensure any newly added bundled decks are present
  if (raw.decks && !Array.isArray(raw.cards)) {
    const baseDecks = freshBundledDecks(now)
    const decks = { ...baseDecks, ...raw.decks }
    return { ...raw, decks }
  }

  // Old shape: cards is an array with front/back inline
  const cardsObj = {}
  const hasLegacy = Array.isArray(raw.cards) && raw.cards.length > 0

  if (hasLegacy) {
    for (const card of raw.cards) {
      cardsObj[card.id] = { ...card, deckId: 'imported' }
    }
  }

  return {
    decks: {
      ...freshBundledDecks(now),
      ...(hasLegacy ? { imported: { id: 'imported', name: 'Imported', source: 'imported', active: true, addedAt: now } } : {}),
    },
    cards: cardsObj,
    lastSession: raw.lastSession ?? null,
    totalReviews: raw.totalReviews ?? 0,
  }
}

// Generates card state entries for all words in a bundled deck.
// Only creates entries for words that don't already have one.
export function initializeDeckCards(progress, deckId) {
  const words = DECK_WORDS[deckId]
  if (!words) return progress

  const newCards = { ...progress.cards }
  for (const word of words) {
    if (!newCards[word.id]) {
      newCards[word.id] = { ...createEmptyCard(), id: word.id, deckId }
    }
  }

  return { ...progress, cards: newCards }
}

export { DECK_WORDS }
