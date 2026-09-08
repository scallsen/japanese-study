import { reviewCard, Rating, State } from './srs.js'

const RELEARN_STEP_MS = 10 * 60 * 1000

// Returns the first queued card that is not waiting for a relearn step, or —
// once nothing else is left to study — the soonest-due waiting card anyway.
// This is Anki's "learn ahead limit" (default 20 minutes): a card in its
// relearn step is shown early rather than blocking the session on real time,
// as long as there's nothing else to answer first. Our relearn step is a
// fixed 10 minutes, always under that limit, so a waiting card is always
// eligible the moment it's the only thing left — the countdown still applies
// while other cards remain to interleave with, and still applies for real if
// the learner exits and comes back before it elapses (getTodaysQueue checks
// the persisted due date against the actual clock).
export function getCurrentCard(session) {
  const now = Date.now()
  const ready = session.queue.find(c => !c.waitUntil || c.waitUntil <= now)
  if (ready) return ready
  return session.queue.reduce((soonest, c) => (!soonest || c.waitUntil < soonest.waitUntil) ? c : soonest, null)
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
    streak: 0,
    bestStreak: 0,
    // Card ids that have received at least one Again this session — lets the
    // HUD split completed cards into "correct" (never missed) vs "troubled"
    // (missed at least once, then eventually got right), same distinction
    // the Vocab Drill's simpleQueue engine already draws.
    troubledIds: new Set(),
  }
}

export function answerCard(session, card, rating, opts = {}) {
  const { leechThreshold = 0 } = opts

  const snapshot = {
    queue: session.queue,
    completed: session.completed,
    againCount: session.againCount,
    goodCount: session.goodCount,
    streak: session.streak,
    bestStreak: session.bestStreak,
    troubledIds: session.troubledIds,
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
    const troubledIds = new Set(session.troubledIds)
    troubledIds.add(card.id)
    if (card.state !== State.New) {
      // Lapsed review card: put at end with a 10-minute relearn wait
      queue.push({ ...updatedCard, waitUntil: Date.now() + RELEARN_STEP_MS })
    } else {
      // New card: requeue at position 3 immediately
      queue.splice(Math.min(queue.length, 3), 0, updatedCard)
    }
    return {
      session: { ...session, queue, history, againCount: session.againCount + 1, streak: 0, troubledIds },
      updatedCard,
      isLeech,
    }
  }

  const streak = session.streak + 1
  return {
    session: {
      ...session,
      queue,
      completed: [...session.completed, updatedCard],
      history,
      goodCount: session.goodCount + 1,
      streak,
      bestStreak: Math.max(session.bestStreak, streak),
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
      streak: snapshot.streak,
      bestStreak: snapshot.bestStreak,
      troubledIds: snapshot.troubledIds,
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
  const troubledCount = session.completed.filter(c => session.troubledIds.has(c.id)).length
  return {
    total: session.initialCount,
    remaining: session.queue.length,
    waitingCount,
    againCount: session.againCount,
    goodCount: session.goodCount,
    // correctCount/troubledCount partition `completed` the same way Vocab
    // Drill's simpleQueue splits retired/troubled — clean-vs-eventually-right —
    // for the shared DrillHUD footer.
    correctCount: session.completed.length - troubledCount,
    troubledCount,
    streak: session.streak,
    bestStreak: session.bestStreak,
    elapsedSeconds: Math.floor((Date.now() - session.startTime) / 1000),
    canUndo: session.history.length > 0,
  }
}
