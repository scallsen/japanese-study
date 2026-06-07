import { reviewCard, Rating, State } from './srs.js'

const RELEARN_STEP_MS = 10 * 60 * 1000

// Returns the first queued card that is not waiting for a relearn step.
export function getCurrentCard(session) {
  const now = Date.now()
  return session.queue.find(c => !c.waitUntil || c.waitUntil <= now) ?? null
}

// ms until the earliest waiting card becomes available, or 0.
export function getWaitMs(session) {
  const now = Date.now()
  let min = Infinity
  for (const c of session.queue) {
    if (c.waitUntil && c.waitUntil > now) min = Math.min(min, c.waitUntil - now)
  }
  return min === Infinity ? 0 : min
}

export function initSession(due, newCards) {
  const queue = [...due, ...newCards]
  return {
    queue,
    completed: [],
    history: [],
    startTime: Date.now(),
    initialCount: queue.length,
    againCount: 0,
    goodCount: 0,
  }
}

export function answerCard(session, card, rating, opts = {}) {
  const { leechThreshold = 0 } = opts

  const snapshot = {
    queue: session.queue,
    completed: session.completed,
    againCount: session.againCount,
    goodCount: session.goodCount,
    answeredCard: card,
  }
  const history = [...session.history, snapshot].slice(-20)

  const reviewed = reviewCard(card, rating)
  const isLeech = leechThreshold > 0
    && rating === Rating.Again
    && card.state !== State.New
    && reviewed.lapses >= leechThreshold
  const updatedCard = isLeech ? { ...reviewed, suspended: true } : reviewed

  const queue = session.queue.filter(c => c.id !== card.id)

  if (rating === Rating.Again) {
    if (card.state !== State.New) {
      // Lapsed review card: put at end with a 10-minute relearn wait
      queue.push({ ...updatedCard, waitUntil: Date.now() + RELEARN_STEP_MS })
    } else {
      // New card: requeue at position 3 immediately
      queue.splice(Math.min(queue.length, 3), 0, updatedCard)
    }
    return {
      session: { ...session, queue, history, againCount: session.againCount + 1 },
      updatedCard,
      isLeech,
    }
  }

  return {
    session: {
      ...session,
      queue,
      completed: [...session.completed, updatedCard],
      history,
      goodCount: session.goodCount + 1,
    },
    updatedCard,
    isLeech,
  }
}

export function undoLastAnswer(session) {
  if (session.history.length === 0) return { session, revertedCard: null }
  const history = [...session.history]
  const snapshot = history.pop()
  return {
    session: {
      ...session,
      queue: snapshot.queue,
      completed: snapshot.completed,
      againCount: snapshot.againCount,
      goodCount: snapshot.goodCount,
      history,
    },
    revertedCard: snapshot.answeredCard,
  }
}

export function isComplete(session) {
  return session.queue.length === 0
}

export function getSessionStats(session) {
  const now = Date.now()
  const waitingCount = session.queue.filter(c => c.waitUntil && c.waitUntil > now).length
  return {
    total: session.initialCount,
    remaining: session.queue.length,
    waitingCount,
    againCount: session.againCount,
    goodCount: session.goodCount,
    elapsedSeconds: Math.floor((Date.now() - session.startTime) / 1000),
    canUndo: session.history.length > 0,
  }
}
