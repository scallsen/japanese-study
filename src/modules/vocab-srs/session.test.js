import { describe, it, expect } from 'vitest'
import { initSession, answerCard, isComplete } from './session.js'
import { createCard, Rating } from './srs.js'

function makeCards(n) {
  return Array.from({ length: n }, (_, i) => createCard(`front-${i}`, `back-${i}`, `card-${i}`))
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
