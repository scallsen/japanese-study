import { describe, it, expect } from 'vitest'
import { initSession, answerCard, undoLastAnswer, isComplete, getCurrentCard, getSessionStats } from './session.js'
import { createCard, Rating, State } from './srs.js'

function makeCards(n) {
  return Array.from({ length: n }, (_, i) => createCard(`front-${i}`, `back-${i}`, `card-${i}`))
}

// createCard() always starts a card in State.New (Again on it requeues
// immediately, no relearn wait) — a review-state card is what actually
// exercises the waitUntil/relearn path.
function makeReviewCard(id) {
  return { ...createCard(`front-${id}`, `back-${id}`, id), state: State.Review }
}

describe('answerCard — Again', () => {
  it('requeues the card (still in queue, not in completed)', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])
    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    expect(session.queue.some(c => c.id === card.id)).toBe(true)
    expect(session.completed.some(c => c.id === card.id)).toBe(false)
  })
})

describe('answerCard — Good', () => {
  it('moves card to completed and removes it from queue', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    expect(session.completed.some(c => c.id === card.id)).toBe(true)
    expect(session.queue.some(c => c.id === card.id)).toBe(false)
  })
})

describe('isComplete', () => {
  it('returns false when queue has cards', () => {
    expect(isComplete(initSession(makeCards(2), []))).toBe(false)
  })

  it('returns true only when queue is empty', () => {
    const session = initSession([], [])
    expect(isComplete(session)).toBe(true)
  })
})

describe('session flow', () => {
  it('card answered Again then Good ends up in completed', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])

    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    expect(isComplete(session)).toBe(false)

    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    expect(session.completed.some(c => c.id === card.id)).toBe(true)
    expect(isComplete(session)).toBe(true)
  })

  it('3 cards all Good: completes in exactly 3 answers', () => {
    let session = initSession(makeCards(3), [])
    for (let i = 0; i < 3; i++) {
      expect(isComplete(session)).toBe(false)
      ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    }
    expect(isComplete(session)).toBe(true)
  })

  it('3 cards, one Again then Good: completes in exactly 4 answers', () => {
    let session = initSession(makeCards(3), [])
    let answers = 0

    // First card gets Again — it requeues behind the remaining two
    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    answers++

    // Answer the next two cards Good
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    answers++
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    answers++

    expect(isComplete(session)).toBe(false)

    // The requeued card is now up — answer it Good
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    answers++

    expect(isComplete(session)).toBe(true)
    expect(answers).toBe(4)
  })
})

describe('getCurrentCard — learn ahead', () => {
  it('a lapsed review card is skipped while it is waiting and another card is ready', () => {
    const reviewCard = makeReviewCard('review-1')
    const [freshCard] = makeCards(1)
    let session = initSession([reviewCard, freshCard], [])

    ;({ session } = answerCard(session, reviewCard, Rating.Again))
    // The lapsed card is now waiting on its relearn step; the other due card
    // is still ready, so it — not the waiting card — comes up next.
    expect(getCurrentCard(session).id).toBe(freshCard.id)
  })

  it('shows the waiting card immediately once it is the only thing left (Anki\'s learn-ahead limit)', () => {
    const reviewCard = makeReviewCard('review-1')
    let session = initSession([reviewCard], [])

    ;({ session } = answerCard(session, reviewCard, Rating.Again))
    // Nothing else in the queue — the session must not block on the real
    // 10-minute relearn timer; it should offer the waiting card right away.
    expect(getCurrentCard(session)?.id).toBe(reviewCard.id)
  })

  it('offers the soonest-due waiting card when several are waiting and nothing else is ready', () => {
    const a = makeReviewCard('a')
    const b = makeReviewCard('b')
    let session = initSession([a, b], [])

    ;({ session } = answerCard(session, a, Rating.Again))
    ;({ session } = answerCard(session, b, Rating.Again))
    // b was queued after a, so its waitUntil is later — a should come up first.
    expect(getCurrentCard(session)?.id).toBe('a')
  })
})

describe('getSessionStats — correct vs troubled', () => {
  it('a card answered Good with no prior mistake counts as correct, not troubled', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])
    ;({ session } = answerCard(session, card, Rating.Good))
    const stats = getSessionStats(session)
    expect(stats.correctCount).toBe(1)
    expect(stats.troubledCount).toBe(0)
  })

  it('a card answered Again then Good counts as troubled, not correct', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])
    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    const stats = getSessionStats(session)
    expect(stats.correctCount).toBe(0)
    expect(stats.troubledCount).toBe(1)
  })

  it('undo restores the troubled/correct split along with the queue', () => {
    const [card] = makeCards(1)
    let session = initSession([card], [])
    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    ;({ session } = undoLastAnswer(session))
    const stats = getSessionStats(session)
    expect(stats.correctCount).toBe(0)
    expect(stats.troubledCount).toBe(0)
    expect(stats.remaining).toBe(1)
  })
})

describe('getSessionStats — streak', () => {
  it('increments on consecutive correct answers and resets on Again', () => {
    const cards = makeCards(3)
    let session = initSession(cards, [])
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    ;({ session } = answerCard(session, session.queue[0], Rating.Good))
    expect(getSessionStats(session).streak).toBe(2)
    expect(getSessionStats(session).bestStreak).toBe(2)

    ;({ session } = answerCard(session, session.queue[0], Rating.Again))
    expect(getSessionStats(session).streak).toBe(0)
    expect(getSessionStats(session).bestStreak).toBe(2)
  })
})
