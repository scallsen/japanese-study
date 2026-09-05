import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'

const LAST_USED_DECK_KEY = 'srs-last-used-deck'

export function getLastUsedDeckId() {
  return safeLocalStorageGet(LAST_USED_DECK_KEY)
}

export function setLastUsedDeckId(deckId) {
  safeLocalStorageSet(LAST_USED_DECK_KEY, deckId)
}

export function clearLastUsedDeckId() {
  safeLocalStorageSet(LAST_USED_DECK_KEY, '')
}

// Bundled-deck cards never store front/back inline — content is resolved from
// static JSON at read time, and resolvedArrayToCardsObj strips inline content back
// out for bundled decks on save. Any card added/moved into a bundled deck would
// have its content silently destroyed on the next save, so callers must exclude
// bundled decks from every add/rename/delete/move destination.
export function isBundledDeck(deck) {
  return deck?.source === 'bundled'
}

// Resolves the deck to quick-add into: storedDeckId if it still exists and isn't
// bundled, otherwise the caller's own hardcoded bootstrap default. Takes the
// stored id as a plain argument (rather than reading localStorage itself) so
// callers rendering UI can pass a React-state mirror of it and stay reactive;
// one-shot event handlers can just pass getLastUsedDeckId() directly.
export function resolveTargetDeckId(decks, storedDeckId, bootstrapDefaultId) {
  if (storedDeckId && decks[storedDeckId] && !isBundledDeck(decks[storedDeckId])) return storedDeckId
  return bootstrapDefaultId
}

// Idempotently ensures a deck record exists. Returns a new decks object; never mutates.
export function ensureDeck(decks, id, name) {
  if (decks[id]) return decks
  return { ...decks, [id]: { id, name, source: 'imported', active: true, addedAt: Date.now() } }
}

// Creates a brand-new imported deck with a generated id.
export function createDeck(decks, name) {
  const deckId = `imported-${crypto.randomUUID()}`
  return { decks: ensureDeck(decks, deckId, name), deckId }
}

// Renames an existing imported deck. No-ops on a missing or bundled deck.
export function renameDeck(decks, deckId, newName) {
  const deck = decks[deckId]
  if (!deck || isBundledDeck(deck)) return decks
  return { ...decks, [deckId]: { ...deck, name: newName } }
}

// Cascade delete: removes the deck record and every card belonging to it.
// No-ops on a missing or bundled deck (guarded here as defense-in-depth —
// callers should already exclude bundled decks from delete UI entirely).
export function deleteDeck(progress, deckId) {
  const deck = progress.decks[deckId]
  if (!deck || isBundledDeck(deck)) return progress
  // eslint-disable-next-line no-unused-vars
  const { [deckId]: _removed, ...decks } = progress.decks
  const cards = Object.fromEntries(
    Object.entries(progress.cards).filter(([, c]) => c.deckId !== deckId)
  )
  return { ...progress, decks, cards }
}

export function moveCardsToDeck(cardsObj, cardIds, targetDeckId) {
  const idSet = new Set(cardIds)
  const next = { ...cardsObj }
  for (const id of idSet) {
    if (next[id]) next[id] = { ...next[id], deckId: targetDeckId }
  }
  return next
}

export function deleteCards(cardsObj, cardIds) {
  const idSet = new Set(cardIds)
  return Object.fromEntries(
    Object.entries(cardsObj).filter(([id]) => !idSet.has(id))
  )
}
