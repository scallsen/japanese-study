import { createEmptyCard } from 'ts-fsrs'

// No bundled deck currently ships — see RETIRED_DECKS below. Kept as an
// object (rather than deleted outright) since a future bundled deck only
// needs an entry here and in freshBundledDecks.
const DECK_WORDS = {}

// Bundled decks that used to ship and no longer do. Their deck entry and all
// their cards are dropped on load, so stored progress heals itself without a
// migration script — a retired deck's cards would otherwise resolve to blank
// front/back and show as empty cards in the drill.
const RETIRED_DECKS = ['core3k', 'core2000', 'keigo']

function freshBundledDecks() {
  return {}
}

// Converts stored progress to the current shape.
// Old shape: { cards: Card[], lastSession, totalReviews }
// New shape: { decks: {}, cards: {}, lastSession, totalReviews }
export function migrateProgress(raw) {
  const now = Date.now()

  // Fresh install
  if (!raw) {
    return { decks: freshBundledDecks(), cards: {}, lastSession: null, totalReviews: 0 }
  }

  // Already new shape — ensure bundled decks are current; drop retired decks
  if (raw.decks && !Array.isArray(raw.cards)) {
    const baseDecks = freshBundledDecks()
    const existingDecks = Object.fromEntries(
      Object.entries(raw.decks).filter(([id]) => !RETIRED_DECKS.includes(id))
    )
    const decks = { ...baseDecks, ...existingDecks }
    const cards = Object.fromEntries(
      Object.entries(raw.cards ?? {}).filter(([, c]) => !RETIRED_DECKS.includes(c.deckId))
    )
    return { ...raw, decks, cards }
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
      ...freshBundledDecks(),
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
