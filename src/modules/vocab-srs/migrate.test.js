import { describe, it, expect } from 'vitest'
import { migrateProgress } from './migrate.js'

// Retiring a bundled deck is the one migration that can silently corrupt a
// user's view: its cards keep their scheduling state but can no longer resolve
// content, so without this filter they render as blank cards in the drill.
describe('migrateProgress — retired bundled decks', () => {
  const stored = {
    decks: {
      core2000: { id: 'core2000', name: 'Core 2000', source: 'bundled', active: true, addedAt: 1 },
      core3k: { id: 'core3k', name: 'Core 3k', source: 'bundled', active: true, addedAt: 1 },
      keigo: { id: 'keigo', name: 'Keigo', source: 'bundled', active: true, addedAt: 1 },
      'story-words': { id: 'story-words', name: 'Story Words', source: 'imported', active: true, addedAt: 2 },
    },
    cards: {
      a: { id: 'a', deckId: 'core2000', reps: 4 },
      b: { id: 'b', deckId: 'core3k', reps: 2 },
      c: { id: 'c', deckId: 'keigo', reps: 1 },
      d: { id: 'd', deckId: 'story-words', front: 'x', back: 'y', reps: 7 },
    },
    lastSession: null,
    totalReviews: 14,
  }

  it('drops the retired decks themselves', () => {
    const { decks } = migrateProgress(stored)
    expect(decks.core2000).toBeUndefined()
    expect(decks.core3k).toBeUndefined()
  })

  it('drops their cards, which could no longer resolve content', () => {
    const { cards } = migrateProgress(stored)
    expect(cards.a).toBeUndefined()
    expect(cards.b).toBeUndefined()
  })

  it('leaves surviving decks and their cards untouched', () => {
    const { decks, cards } = migrateProgress(stored)
    expect(decks.keigo).toBeDefined()
    expect(decks['story-words']).toBeDefined()
    expect(cards.c).toMatchObject({ id: 'c', reps: 1 })
    expect(cards.d).toMatchObject({ id: 'd', front: 'x', reps: 7 })
  })

  it('keeps unrelated top-level fields', () => {
    expect(migrateProgress(stored).totalReviews).toBe(14)
  })

  it('is idempotent — a second pass changes nothing', () => {
    const once = migrateProgress(stored)
    const twice = migrateProgress(once)
    expect(Object.keys(twice.cards).sort()).toEqual(Object.keys(once.cards).sort())
    expect(Object.keys(twice.decks).sort()).toEqual(Object.keys(once.decks).sort())
  })

  it('offers only the still-shipping bundled decks on a fresh install', () => {
    const { decks, cards } = migrateProgress(null)
    expect(Object.keys(decks)).toEqual(['keigo'])
    expect(cards).toEqual({})
  })
})
