import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../utils/storage.js'

// The plain key is the anonymous (signed-out) store — the only thing that
// key ever holds. A signed-in user's cache lives under its own per-account
// key instead, so the two can never bleed into each other: picking something
// while signed in must not resurface at the next sign-out, and a second
// account signing in on the same browser must not inherit the first
// account's cache. See the storage audit in CLAUDE.md for the incident this
// fixed (a personal-only textbook survived sign-out because both states
// shared one key).
function anonKey(namespace) {
  return `progress-${namespace}`
}
function accountCacheKey(namespace, userId) {
  return `progress-${namespace}-u${userId}`
}

export function useProgress(namespace) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    setLoading(true)
    if (user && supabase) {
      const cacheKey = accountCacheKey(namespace, user.id)
      supabase
        .from('progress')
        .select('payload')
        .eq('user_id', user.id)
        .eq('namespace', namespace)
        .maybeSingle()
        .then(({ data: row, error }) => {
          if (error) {
            console.error('[useProgress] Supabase load failed:', error.message)
            const stored = safeLocalStorageGet(cacheKey)
            setData(stored ? JSON.parse(stored) : null)
          } else if (row) {
            setData(row.payload)
            safeLocalStorageSet(cacheKey, JSON.stringify(row.payload))
            // This account's data now lives in Supabase — an anonymous copy
            // under the plain key is either stale or (if this browser was
            // ever signed into a different account) someone else's, so it
            // must not be left around to resurface at the next sign-out.
            safeLocalStorageRemove(anonKey(namespace))
          } else {
            // No Supabase row yet — first sign-in. Adopt whatever anonymous
            // progress this browser has as the account's starting state,
            // then retire the anonymous copy: it now belongs to the account.
            const stored = safeLocalStorageGet(anonKey(namespace))
            const local = stored ? JSON.parse(stored) : null
            if (local) {
              supabase.from('progress').upsert(
                { id: crypto.randomUUID(), user_id: user.id, namespace, payload: local, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,namespace' }
              ).then(({ error: migrateError }) => {
                if (migrateError) console.error('[useProgress] Migration failed:', migrateError.message)
              })
              setData(local)
              safeLocalStorageSet(cacheKey, JSON.stringify(local))
              safeLocalStorageRemove(anonKey(namespace))
            } else {
              setData(null)
            }
          }
          setLoading(false)
        })
    } else {
      const stored = safeLocalStorageGet(anonKey(namespace))
      setData(stored ? JSON.parse(stored) : null)
      setLoading(false)
    }
  }, [user, authLoading, namespace])

  async function save(payload) {
    setData(payload)
    if (user && supabase) {
      safeLocalStorageSet(accountCacheKey(namespace, user.id), JSON.stringify(payload))
      const { error } = await supabase.from('progress').upsert(
        { id: crypto.randomUUID(), user_id: user.id, namespace, payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,namespace' }
      )
      if (error) console.error('[useProgress] Supabase save failed:', error.message)
    } else {
      safeLocalStorageSet(anonKey(namespace), JSON.stringify(payload))
    }
  }

  return { data, save, loading }
}
