import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js'

export function useProgress(namespace) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    setLoading(true)
    if (user && supabase) {
      supabase
        .from('progress')
        .select('payload')
        .eq('user_id', user.id)
        .eq('namespace', namespace)
        .maybeSingle()
        .then(({ data: row, error }) => {
          if (error) {
            console.error('[useProgress] Supabase load failed:', error.message)
            const stored = safeLocalStorageGet(`progress-${namespace}`)
            setData(stored ? JSON.parse(stored) : null)
          } else if (row) {
            setData(row.payload)
          } else {
            // No Supabase row — migrate from localStorage if available
            const stored = safeLocalStorageGet(`progress-${namespace}`)
            const local = stored ? JSON.parse(stored) : null
            if (local) {
              supabase.from('progress').upsert(
                { id: crypto.randomUUID(), user_id: user.id, namespace, payload: local, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,namespace' }
              ).then(({ error: migrateError }) => {
                if (migrateError) console.error('[useProgress] Migration failed:', migrateError.message)
              })
              setData(local)
            } else {
              setData(null)
            }
          }
          setLoading(false)
        })
    } else {
      const stored = safeLocalStorageGet(`progress-${namespace}`)
      setData(stored ? JSON.parse(stored) : null)
      setLoading(false)
    }
  }, [user, authLoading, namespace])

  async function save(payload) {
    setData(payload)
    safeLocalStorageSet(`progress-${namespace}`, JSON.stringify(payload))
    if (user && supabase) {
      const { error } = await supabase.from('progress').upsert(
        { id: crypto.randomUUID(), user_id: user.id, namespace, payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,namespace' }
      )
      if (error) console.error('[useProgress] Supabase save failed:', error.message)
    }
  }

  return { data, save, loading }
}
