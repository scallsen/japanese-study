import { useState, useEffect, useCallback, useRef } from 'react'
import * as SimpleQueue from '../engines/simpleQueue.js'

export function useDrill(pool, { engine = SimpleQueue, floatSize = 7, seekCardId = null } = {}) {
  const [state, setState] = useState(() => engine.init(pool, floatSize))

  // Reinitialize when the pool reference changes (options changed).
  const poolRef = useRef(pool)
  useEffect(() => {
    if (pool !== poolRef.current) {
      poolRef.current = pool
      const next = engine.init(pool, floatSize)
      if (seekCardId) {
        const target = next.float.find(c => c.id === seekCardId)
                    ?? next.pool.find(c => c.id === seekCardId)
        if (target) {
          setState({
            ...next,
            float: [target, ...next.float.filter(c => c.id !== seekCardId)],
            pool:  next.pool.filter(c => c.id !== seekCardId),
          })
          return
        }
      }
      setState(next)
    }
  }, [pool, engine, floatSize, seekCardId])

  const onCorrect     = useCallback(() => setState(s => engine.onCorrect(s)), [engine])
  const onWrong       = useCallback(() => setState(s => engine.onWrong(s)),   [engine])
  const onUndo        = useCallback(() => setState(s => engine.onUndo ? engine.onUndo(s) : s), [engine])
  const restart       = useCallback(() => setState(engine.init(poolRef.current, floatSize)), [engine, floatSize])
  const redoTroubled  = useCallback(() => setState(s => engine.init(s.troubled, floatSize)), [engine, floatSize])
  const redoSelection = useCallback(specs => setState(engine.init(specs, floatSize)), [engine, floatSize])

  return {
    currentCard:  state.float[0] ?? null,
    upcoming:     state.float.slice(1),
    streak:       state.streak,
    bestStreak:   state.bestStreak ?? 0,
    correct:      state.retired.length,
    troubled:     state.troubled.length,
    troubledPool: state.troubled,
    remaining:    state.float.length + state.pool.length,
    done:         state.float.length === 0,
    mistakeCounts: state.mistakeCounts ?? {},
    canUndo:      state.prevSnapshot !== null,
    prevCard:     state.prevSnapshot?.float[0] ?? null,
    onCorrect,
    onWrong,
    onUndo,
    restart,
    redoTroubled,
    redoSelection,
  }
}
