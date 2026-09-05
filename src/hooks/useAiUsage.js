import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

// Today's AI usage, keyed by feature, for the signed-in user. RLS restricts
// the table to your own rows, so there is no filtering to get wrong here.
//
// The `day` column is a UTC date server-side, so this asks for a UTC date too —
// deriving it from the local date would roll the counter over at the wrong
// moment for most of the world, and disagree with what the server counted.
//
// `refresh` exists because a caller that just spent quota (generating a story)
// should be able to update the display without a reload.
export function useAiUsage() {
  const { user } = useAuth()
  const [usage, setUsage] = useState({ today: {}, lifetime: {} })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !supabase) {
      setUsage({ today: {}, lifetime: {} })
      setLoading(false)
      return
    }
    // Every row, then summed here rather than in SQL: an aggregate would need
    // its own RPC executable by `authenticated`, and this is a handful of rows
    // per feature per day for one user.
    const { data } = await supabase
      .from('ai_usage')
      .select('feature, count, day')
      .eq('user_id', user.id)

    const todayStr = new Date().toISOString().slice(0, 10)
    const today = {}
    const lifetime = {}
    for (const row of data ?? []) {
      lifetime[row.feature] = (lifetime[row.feature] ?? 0) + row.count
      if (row.day === todayStr) today[row.feature] = (today[row.feature] ?? 0) + row.count
    }
    setUsage({ today, lifetime })
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  return { usage, loading, refresh: load }
}
