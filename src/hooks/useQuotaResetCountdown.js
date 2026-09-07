import { useState, useEffect } from 'react'

// Minute granularity, so a half-minute tick keeps the displayed value at most
// 30s stale without running a timer every second for a number that rarely
// changes.
const TICK_MS = 30_000

// 00:00 UTC — the same boundary useAiUsage counts against and the server's own
// `day` column rolls over on, not the viewer's local midnight.
export function msUntilUtcReset(now = Date.now()) {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next.getTime() - now
}

// Rounded up: a countdown reading "0min" while there is still time left is
// worse than one minute of optimism, and it means the last minute shows
// "1min" rather than counting through zero.
export function formatResetCountdown(ms) {
  const totalMinutes = Math.ceil(Math.max(0, ms) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export function useQuotaResetCountdown() {
  const [remaining, setRemaining] = useState(() => msUntilUtcReset())

  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilUtcReset()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return formatResetCountdown(remaining)
}
