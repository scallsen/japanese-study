import { useEffect, useState } from 'react'

// Returns true only once `loading` has been true for at least `delayMs`, and
// flips back to false the instant `loading` does. Lets loading UI (a top
// progress bar, a centered "why this is taking a while" message) stay silent
// for fast operations — cache hits, quick queries — and only appear for
// genuinely slow ones, without every call site having to classify itself as
// "long" or "short" up front.
export function useDelayedLoading(loading, delayMs = 220) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!loading) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(timer)
  }, [loading, delayMs])

  return show
}
