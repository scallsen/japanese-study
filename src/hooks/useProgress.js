import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export function useProgress(namespace) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && supabase) {
      supabase
        .from('progress')
        .select('payload')
        .eq('user_id', user.id)
        .eq('namespace', namespace)
        .single()
        .then(({ data: row }) => {
          setData(row?.payload ?? null)
          setLoading(false)
        })
    } else {
      try {
        const raw = localStorage.getItem(`progress-${namespace}`)
        setData(raw ? JSON.parse(raw) : null)
      } catch {
        setData(null)
      }
      setLoading(false)
    }
  }, [user, namespace])

  const save = useCallback(async (payload) => {
    setData(payload)
    if (user && supabase) {
      await supabase.from('progress').upsert(
        { user_id: user.id, namespace, payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,namespace' },
      )
    } else {
      try {
        localStorage.setItem(`progress-${namespace}`, JSON.stringify(payload))
      } catch {
        // storage unavailable or quota exceeded
      }
    }
  }, [user, namespace])

  return { data, save, loading }
}
