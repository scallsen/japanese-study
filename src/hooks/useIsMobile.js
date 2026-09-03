import { useState, useEffect } from 'react'

// Was copy-pasted identically into ten module/page files. The initial value
// reads the same media query the listener subscribes to, so the first render
// and every later change agree on exactly one definition of "mobile" (eight
// of the copies initialised from window.innerWidth instead — equivalent, but
// two sources of truth for one breakpoint).
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(`(max-width: ${breakpoint}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}
