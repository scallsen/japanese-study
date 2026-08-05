import { describe, it, expect } from 'vitest'
import { createCard, reviewCard, getStateDistribution, Rating, State } from './srs.js'

function newCard() {
  return createCard('front', 'back', 'test-1')
}

// Simulate reviewing a card on its due date so FSRS computes realistic stability growth
function reviewOnDue(card, rating) {
  return reviewCard(card, rating, new Date(card.due))
}

function advanceToReview(card) {
  card = reviewOnDue(card, Rating.Good)                // New → Learning
  card = reviewOnDue(card, Rating.Good)                // Learning → Review
  card = reviewOnDue(card, Rating.Good)                // Review (stability starts growing here)
  return card
}

describe('reviewCard — Good on a new card', () => {
  it('state changes from New and stability is >= 1', () => {
    const card = newCard()
    expect(card.state).toBe(State.New)
    const result = reviewOnDue(card, Rating.Good)
    expect(result.state).not.toBe(State.New)
    expect(result.stability).toBeGreaterThanOrEqual(1)
  })
})

describe('reviewCard — Again on a new card', () => {
  it('card stays New', () => {
    const result = reviewOnDue(newCard(), Rating.Again)
    expect(result.state).toBe(State.New)
  })
})

describe('reviewCard — Good answers over multiple reviews', () => {
  it('stability grows on each successive Good answer in Review phase', () => {
    let card = advanceToReview(newCard())
    expect(card.state).toBe(State.Review)

    let prev = card.stability
    for (let i = 0; i < 4; i++) {
      card = reviewOnDue(card, Rating.Good)
      expect(card.stability).toBeGreaterThan(prev)
      prev = card.stability
    }
  })
})

describe('reviewCard — Again on a review card', () => {
  it('interval resets significantly and difficulty increases', () => {
    let card = advanceToReview(newCard())
    expect(card.state).toBe(State.Review)

    const prevDays = card.scheduled_days
    const prevDifficulty = card.difficulty

    const result = reviewOnDue(card, Rating.Again)
    expect(result.scheduled_days).toBeLessThan(prevDays)
    expect(result.difficulty).toBeGreaterThan(prevDifficulty)
  })
})

describe('reviewCard — difficulty bounds', () => {
  it('difficulty stays within FSRS bounds [1, 10] after repeated Again answers', () => {
    let card = advanceToReview(newCard())
    for (let i = 0; i < 10; i++) {
      card = reviewOnDue(card, Rating.Again)
      expect(card.difficulty).toBeGreaterThanOrEqual(1)
      expect(card.difficulty).toBeLessThanOrEqual(10)
    }
  })
})

describe('reviewCard — due date after Good', () => {
  it('due date is always in the future after a Good answer', () => {
    const before = Date.now()
    const result = reviewOnDue(newCard(), Rating.Good)
    expect(new Date(result.due).getTime()).toBeGreaterThan(before)
  })
})

describe('getStateDistribution', () => {
  const decks = {
    active: { id: 'active', active: true },
    inactive: { id: 'inactive', active: false },
  }

  it('buckets by state, splits Review into young/mature at the 21-day threshold, and counts suspended separately', () => {
    const cards = {
      c1: { deckId: 'active', state: State.New },
      c2: { deckId: 'active', state: State.Learning },
      c3: { deckId: 'active', state: State.Review, scheduled_days: 20 },
      c4: { deckId: 'active', state: State.Review, scheduled_days: 21 },
      c5: { deckId: 'active', state: State.Relearning },
      c6: { deckId: 'active', state: State.Review, scheduled_days: 30, suspended: true },
      c7: { deckId: 'inactive', state: State.New },
    }

    const dist = getStateDistribution(cards, decks)

    expect(dist).toEqual({
      new: 1,
      learning: 1,
      young: 1,
      mature: 2,
      relearning: 1,
      suspended: 1,
      total: 6,
    })
  })
})
