import { reviewCard, Rating } from './srs.js'

export function initSession(due, newCards) {
  const queue = [...due, ...newCards]
  return {
    queue,
    completed: [],
    startTime: Date.now(),
    initialCount: queue.length,
    againCount: 0,
    goodCount: 0,
  }
}

export function answerCard(session, card, rating) {
  const updatedCard = reviewCard(card, rating)
  const queue = session.queue.filter(c => c.id !== card.id)

  if (rating === Rating.Again) {
    const insertAt = Math.min(queue.length, 3)
    queue.splice(insertAt, 0, updatedCard)
    return {
      session: { ...session, queue, againCount: session.againCount + 1 },
      updatedCard,
    }
  }

  return {
    session: {
      ...session,
      queue,
      completed: [...session.completed, updatedCard],
      goodCount: session.goodCount + 1,
    },
    updatedCard,
  }
}

export function isComplete(session) {
  return session.queue.length === 0
}

export function getSessionStats(session) {
  return {
    total: session.initialCount,
    remaining: session.queue.length,
    againCount: session.againCount,
    goodCount: session.goodCount,
    elapsedSeconds: Math.floor((Date.now() - session.startTime) / 1000),
  }
}
