import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { GLOBAL_AI_DAILY_LIMITS } from '../data/aiLimits.js'

/**
 * Whether an AI feature is currently usable, for the "temporarily unavailable"
 * banner. Answers the app-wide question only — a user who is simply out of
 * their own five generations for the day is not "unavailable", and gets the
 * per-user message from the server instead.
 *
 * Returns `true` until proven otherwise: an unreachable RPC, a missing function
 * (before the SQL is applied), or a signed-out visitor should all leave the UI
 * exactly as it was rather than announcing an outage that isn't happening. This
 * mirrors the edge function's own fail-open behaviour, so the two can't
 * disagree in the direction that would block someone unnecessarily.
 */
export function useAiAvailability(feature) {
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    let cancelled = false
    const limit = GLOBAL_AI_DAILY_LIMITS[feature]
    if (!limit) return

    supabase.rpc('ai_availability').then(({ data, error }) => {
      if (cancelled || error || !data) return
      // A user on their own key isn't spending the app's budget, so the ceiling
      // never applies to them — showing them the banner would be a plain lie.
      if (data.ownKey) return
      const used = data.usage?.[feature] ?? 0
      setAvailable(used < limit)
    })

    return () => { cancelled = true }
  }, [feature])

  return available
}
