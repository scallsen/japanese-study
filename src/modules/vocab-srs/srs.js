import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import CORE3K from './decks/core3k.json'
import KEIGO from './decks/keigo.json'

const f = fsrs(generatorParameters({ enable_fuzz: true }))

export { Rating, State }

// Maps deckId → (cardId → word object) for bundled decks
const DECK_FILES = {
  'core3k': new Map(CORE3K.map(w => [w.id, w])),
  'keigo': new Map(KEIGO.map(w => [w.id, w])),
}

// Creates FSRS scheduling state for a bundled card (no content stored).
export function createBundledCardState(id, deckId) {
  return { ...createEmptyCard(), id, deckId }
}

// Resets a card's FSRS scheduling state to initial, preserving its identity and content fields.
export function resetCardProgress(card) {
  const reset = { ...createEmptyCard(), id: card.id, deckId: card.deckId }
  if ('front' in card) {
    reset.front = card.front
    reset.back = card.back
    if (card.source !== undefined) reset.source = card.source
    if (card.addedAt !== undefined) reset.addedAt = card.addedAt
  }
  return reset
}

// Creates a full card for imported decks (content stored inline).
export function createCard(front, back, id, deckId = 'imported') {
  return { ...createEmptyCard(), id, deckId, front, back, source: 'imported', addedAt: Date.now() }
}

export function reviewCard(card, rating, now = new Date()) {
  const result = f.next(card, now, rating)
  const updated = { ...card, ...result.card }
  // FSRS transitions New→Learning on Again, but we have no learning phase —
  // keep unseen cards in New until their first correct answer
  if (card.state === State.New && rating === Rating.Again) {
    updated.state = State.New
  }
  return updated
}

// Returns the FSRS-projected due date for each rating, used for button interval hints.
export function previewIntervals(card, now = new Date()) {
  const result = {}
  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    try {
      result[rating] = new Date(f.next(card, now, rating).card.due)
    } catch {
      result[rating] = now
    }
  }
  return result
}

// Resolves a card state to include front/back content.
// Bundled cards look up content from the static JSON; imported cards carry it inline.
export function resolveCard(cardState, deckFiles = DECK_FILES) {
  if ('front' in cardState) return cardState
  const wordMap = deckFiles[cardState.deckId]
  const word = wordMap?.get(cardState.id)
  return { ...cardState, front: word?.front ?? '', back: word?.back ?? '' }
}

// cardsObj: { [cardId]: cardState }
// decks: { [deckId]: { id, active, ... } }
export function getTodaysQueue(cardsObj, decks, { newPerDay = Infinity, maxOverdueDays = 7 } = {}) {
  const activeDeckIds = new Set(
    Object.values(decks).filter(d => d.active).map(d => d.id)
  )
  const now = new Date()
  const maxOverdueMs = maxOverdueDays * 24 * 60 * 60 * 1000

  const due = []
  const rescheduled = []
  const newCards = []

  for (const card of Object.values(cardsObj)) {
    if (!activeDeckIds.has(card.deckId)) continue
    if (card.suspended) continue

    if (card.state === State.New) {
      newCards.push(card)
      continue
    }
    if (card.due) {
      const dueDate = new Date(card.due)
      if (dueDate <= now) {
        if (now - dueDate > maxOverdueMs) rescheduled.push({ ...card, due: now.toISOString() })
        else due.push(card)
      }
    }
  }

  return { due, newCards: newCards.slice(0, newPerDay), rescheduled }
}

// Stats for a single deck.
export function getDeckStats(cardsObj, deckId) {
  const now = new Date()
  const maxOverdueMs = 7 * 24 * 60 * 60 * 1000
  let dueToday = 0, newAvailable = 0, learned = 0

  for (const card of Object.values(cardsObj)) {
    if (card.deckId !== deckId) continue
    if (card.state === State.New) {
      newAvailable++
    } else {
      learned++
      if (card.due) {
        const dueDate = new Date(card.due)
        if (dueDate <= now && now - dueDate <= maxOverdueMs) dueToday++
      }
    }
  }

  return { deckId, total: newAvailable + learned, dueToday, newAvailable, learned }
}

// Stats across all active decks.
export function getGlobalStats(cardsObj, decks) {
  const activeDeckIds = new Set(
    Object.values(decks).filter(d => d.active).map(d => d.id)
  )
  const now = new Date()
  const maxOverdueMs = 7 * 24 * 60 * 60 * 1000
  let dueToday = 0, newAvailable = 0, learned = 0, totalCards = 0

  for (const card of Object.values(cardsObj)) {
    if (!activeDeckIds.has(card.deckId)) continue
    totalCards++
    if (card.state === State.New) {
      newAvailable++
    } else {
      learned++
      if (card.due) {
        const dueDate = new Date(card.due)
        if (dueDate <= now && now - dueDate <= maxOverdueMs) dueToday++
      }
    }
  }

  const estimatedMinutes = Math.ceil((dueToday + Math.min(newAvailable, 10)) * 0.25)
  const activeDecks = Object.values(decks).filter(d => d.active).length

  return { totalCards, dueToday, newAvailable, learned, estimatedMinutes, activeDecks }
}

// Counts of cards in each FSRS state, scoped to active decks.
export function getCardStateCounts(cardsObj, decks) {
  const activeDeckIds = new Set(
    Object.values(decks).filter(d => d.active).map(d => d.id)
  )
  let unlearned = 0, learning = 0, graduated = 0, relearning = 0
  for (const card of Object.values(cardsObj)) {
    if (!activeDeckIds.has(card.deckId)) continue
    if (card.state === State.New) unlearned++
    else if (card.state === State.Learning) learning++
    else if (card.state === State.Review) graduated++
    else if (card.state === State.Relearning) relearning++
  }
  return { unlearned, learning, graduated, relearning }
}

// Backward-compat: takes a plain card array (old storage shape).
export function getStats(cards) {
  const now = new Date()
  const maxOverdueMs = 7 * 24 * 60 * 60 * 1000
  let dueToday = 0, newAvailable = 0, learned = 0

  for (const card of cards) {
    if (card.state === State.New) {
      newAvailable++
    } else {
      learned++
      if (card.due) {
        const dueDate = new Date(card.due)
        if (dueDate <= now && now - dueDate <= maxOverdueMs) dueToday++
      }
    }
  }

  const estimatedMinutes = Math.ceil((dueToday + Math.min(newAvailable, 10)) * 0.25)
  return { total: cards.length, dueToday, newAvailable, learned, estimatedMinutes }
}
