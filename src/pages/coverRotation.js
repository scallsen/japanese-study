import { useState, useEffect, useRef, useCallback } from 'react'

// Kept out of homeCards.jsx (a component file) to satisfy react-refresh
// lint — same reasoning as chapterAction.jsx: a non-component export mixed
// into a file of components breaks fast refresh for that file.

const EXIT_MS = 550

// One rotation timer, shared by every consumer that mounts this hook — the
// lab page at #/dev/cover-rotation runs four of these side by side (one per
// animation variant) to compare them without their timers drifting out of
// sync with each other.
export function useCoverRotation(count, intervalMs) {
  const [current, setCurrent] = useState(0)
  const [outgoing, setOutgoing] = useState(null) // { index, cycleId } | null
  const cycleRef = useRef(0)
  const timerRef = useRef(null)

  const advance = useCallback(() => {
    setCurrent(prev => {
      const next = (prev + 1) % count
      cycleRef.current += 1
      setOutgoing({ index: prev, cycleId: cycleRef.current })
      return next
    })
  }, [count])

  useEffect(() => {
    timerRef.current = setInterval(advance, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [advance, intervalMs])

  useEffect(() => {
    if (outgoing == null) return
    const t = setTimeout(() => {
      setOutgoing(o => (o && o.cycleId === outgoing.cycleId ? null : o))
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [outgoing])

  function advanceNow() {
    advance()
    clearInterval(timerRef.current)
    timerRef.current = setInterval(advance, intervalMs)
  }

  return { current, outgoing, advanceNow }
}
