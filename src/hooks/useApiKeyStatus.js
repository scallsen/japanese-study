import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { callFunction } from '../lib/functionsClient.js'

// Whether the signed-in user has their own Anthropic key, and its last four
// characters. This has to go through an edge function rather than a table read:
// user_api_keys has no policy or grant for `authenticated` at all, so the
// client cannot query it — which is the point.
//
// `hint` is null both when no key is set and while still loading, so callers
// that must not flash the wrong state should wait on `loading`.
export function useApiKeyStatus() {
  const { user } = useAuth()
  const [hint, setHint] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !supabase) {
      setHint(null)
      setLoading(false)
      return
    }
    try {
      const data = await callFunction('user-api-key', { action: 'status' })
      setHint(data?.hint ?? null)
    } catch {
      // Treat an unreachable status check as "no key": the server decides
      // metering anyway, so the worst case is showing the quota to someone who
      // isn't being charged against it.
      setHint(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  return { hint, hasKey: hint != null, loading, refresh: load }
}
