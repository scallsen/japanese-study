import { describe, it, expect, beforeEach, vi } from 'vitest'

// Node's test environment has no functional localStorage (its built-in global
// localStorage is a stub that throws unless run with --localstorage-file), so
// stand in with a plain in-memory map for the safeLocalStorageGet/Set wrappers.
const store = new Map()
vi.mock('../../utils/storage.js', () => ({
  safeLocalStorageGet: key => (store.has(key) ? store.get(key) : null),
  safeLocalStorageSet: (key, value) => store.set(key, value),
}))

const {
  getLastUsedDeckId,
  setLastUsedDeckId,
  clearLastUsedDeckId,
  isBundledDeck,
  resolveTargetDeckId,
  ensureDeck,
  createDeck,
  renameDeck,
  deleteDeck,
  moveCardsToDeck,
  deleteCards,
} = await import('./deckUtils.js')

const bundledDeck = { id: 'core2000', name: 'Core 2000', source: 'bundled', active: true, addedAt: 1 }
const importedDeck = { id: 'story-words', name: 'Story Words', source: 'imported', active: true, addedAt: 2 }

beforeEach(() => {
  store.clear()
})

describe('last-used deck storage', () => {
  it('round-trips through localStorage', () => {
    expect(getLastUsedDeckId()).toBeNull()
    setLastUsedDeckId('story-words')
    expect(getLastUsedDeckId()).toBe('story-words')
    clearLastUsedDeckId()
    expect(getLastUsedDeckId()).toBe('')
  })
})

describe('isBundledDeck', () => {
  it('distinguishes bundled from imported', () => {
    expect(isBundledDeck(bundledDeck)).toBe(true)
    expect(isBundledDeck(importedDeck)).toBe(false)
    expect(isBundledDeck(undefined)).toBe(false)
  })
})

describe('resolveTargetDeckId', () => {
  const decks = { core2000: bundledDeck, 'story-words': importedDeck }

  it('falls back to bootstrap default when nothing stored', () => {
    expect(resolveTargetDeckId(decks, null, 'immersion-words')).toBe('immersion-words')
  })

  it('uses the stored deck when it exists and is imported', () => {
    expect(resolveTargetDeckId(decks, 'story-words', 'immersion-words')).toBe('story-words')
  })

  it('falls back when the stored deck no longer exists', () => {
    expect(resolveTargetDeckId(decks, 'deleted-deck', 'immersion-words')).toBe('immersion-words')
  })

  it('falls back when the stored deck is bundled', () => {
    expect(resolveTargetDeckId(decks, 'core2000', 'immersion-words')).toBe('immersion-words')
  })
})

describe('ensureDeck', () => {
  it('creates the deck when missing', () => {
    const decks = ensureDeck({}, 'immersion-words', 'Immersion Words')
    expect(decks['immersion-words']).toMatchObject({ id: 'immersion-words', name: 'Immersion Words', source: 'imported', active: true })
  })

  it('is a no-op when the deck already exists', () => {
    const decks = { 'story-words': importedDeck }
    expect(ensureDeck(decks, 'story-words', 'Ignored')).toBe(decks)
  })
})

describe('createDeck', () => {
  it('generates a unique imported deck id', () => {
    const { decks, deckId } = createDeck({}, 'My Deck')
    expect(deckId).toMatch(/^imported-/)
    expect(decks[deckId]).toMatchObject({ name: 'My Deck', source: 'imported', active: true })
  })
})

describe('renameDeck', () => {
  it('renames an imported deck', () => {
    const decks = renameDeck({ 'story-words': importedDeck }, 'story-words', 'News Words')
    expect(decks['story-words'].name).toBe('News Words')
  })

  it('no-ops on a bundled deck', () => {
    const decks = { core2000: bundledDeck }
    expect(renameDeck(decks, 'core2000', 'Hacked')).toBe(decks)
  })

  it('no-ops on a missing deck', () => {
    const decks = {}
    expect(renameDeck(decks, 'nope', 'Name')).toBe(decks)
  })
})

describe('deleteDeck', () => {
  it('cascades to remove the deck and its cards', () => {
    const progress = {
      decks: { 'story-words': importedDeck, core2000: bundledDeck },
      cards: {
        c1: { id: 'c1', deckId: 'story-words' },
        c2: { id: 'c2', deckId: 'core2000' },
      },
    }
    const result = deleteDeck(progress, 'story-words')
    expect(result.decks['story-words']).toBeUndefined()
    expect(result.decks.core2000).toBeDefined()
    expect(result.cards.c1).toBeUndefined()
    expect(result.cards.c2).toBeDefined()
  })

  it('no-ops on a bundled deck', () => {
    const progress = { decks: { core2000: bundledDeck }, cards: {} }
    expect(deleteDeck(progress, 'core2000')).toBe(progress)
  })

  it('no-ops on a missing deck', () => {
    const progress = { decks: {}, cards: {} }
    expect(deleteDeck(progress, 'nope')).toBe(progress)
  })
})

describe('moveCardsToDeck', () => {
  it('reassigns deckId for the given card ids only', () => {
    const cardsObj = {
      c1: { id: 'c1', deckId: 'a' },
      c2: { id: 'c2', deckId: 'a' },
      c3: { id: 'c3', deckId: 'a' },
    }
    const result = moveCardsToDeck(cardsObj, ['c1', 'c3'], 'b')
    expect(result.c1.deckId).toBe('b')
    expect(result.c2.deckId).toBe('a')
    expect(result.c3.deckId).toBe('b')
  })
})

describe('deleteCards', () => {
  it('removes the given card ids only', () => {
    const cardsObj = { c1: {}, c2: {}, c3: {} }
    const result = deleteCards(cardsObj, ['c2'])
    expect(Object.keys(result).sort()).toEqual(['c1', 'c3'])
  })
})
