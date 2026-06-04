// Engine contract: export { label, description, init, onCorrect, onWrong }
// State shape: { float, pool, retired, streak, totalCorrect, totalWrong }
//
// float    — active card specs; float[0] is always current
// pool     — unplayed specs waiting to enter float
// retired  — correctly answered specs (finished)
//
// Wrong cards reinsert into the float WRONG_INSERT_OFFSET positions ahead,
// so the user sees a few different cards before it returns.

export const label = 'Simple Queue'
export const description = 'Wrong cards return after a few correct answers. Streak resets on wrong.'

const WRONG_INSERT_OFFSET = 3

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Prefer a pool card whose word isn't already in the float.
// Falls back to pool[0] if all pool cards share a word with the float.
function nextPoolIndex(pool, float) {
  const floatWordIds = new Set(float.map(c => c.word.id))
  const idx = pool.findIndex(c => !floatWordIds.has(c.word.id))
  return idx !== -1 ? idx : 0
}

export function init(pool, floatSize = 7) {
  const shuffled = shuffle(pool)
  return {
    float:        shuffled.slice(0, floatSize),
    pool:         shuffled.slice(floatSize),
    retired:      [],
    troubled:     [],
    everWrong:    {},
    streak:       0,
    bestStreak:   0,
    prevSnapshot: null,
  }
}

export function onCorrect(state) {
  const [current, ...rest] = state.float

  const idx  = state.pool.length ? nextPoolIndex(state.pool, rest) : -1
  const next = idx >= 0 ? state.pool[idx] : null
  const newPool = next ? state.pool.filter((_, i) => i !== idx) : state.pool
  const newStreak = state.streak + 1
  const isTroubled = !!state.everWrong[current.id]

  return {
    ...state,
    float:    next ? [...rest, next] : rest,
    pool:     newPool,
    retired:  isTroubled ? state.retired              : [...state.retired,  current],
    troubled: isTroubled ? [...state.troubled, current] : state.troubled,
    streak:       newStreak,
    bestStreak:   Math.max(state.bestStreak, newStreak),
    prevSnapshot: { ...state, prevSnapshot: null },
  }
}

export function onWrong(state) {
  const [current, ...rest] = state.float
  const insertAt = Math.min(WRONG_INSERT_OFFSET, rest.length)
  const newFloat = [...rest.slice(0, insertAt), current, ...rest.slice(insertAt)]

  return {
    ...state,
    float:     newFloat,
    everWrong: { ...state.everWrong, [current.id]: true },
    streak:    0,
    prevSnapshot: { ...state, prevSnapshot: null },
  }
}

export function onUndo(state) {
  if (!state.prevSnapshot) return state
  return { ...state.prevSnapshot, prevSnapshot: null }
}
