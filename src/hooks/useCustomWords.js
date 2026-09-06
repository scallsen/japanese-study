import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

// A learner's own word lists, which live in their account rather than in the
// bundle (see supabase/migrations/*_add_custom_words.sql). Everything here is
// row-level-security scoped, so these queries are already "mine" without saying
// so — a signed-out visitor simply gets nothing.
//
// Two hooks rather than one because the two needs are different sizes: drawing
// the chapter picker needs 36 numbers, while drilling needs the words of the
// chapters actually chosen. Loading every word to count them would pull about a
// megabyte to render some tile labels.

const countCache = new Map()   // userId -> { [listKey]: n }
const wordCache = new Map()    // `${userId}|${listKey}` -> word[]

/** Word count per chapter, for the picker. `{}` until loaded or when signed out. */
export function useCustomWordCounts() {
  const { user } = useAuth()
  const [counts, setCounts] = useState(() => countCache.get(user?.id) ?? {})

  useEffect(() => {
    if (!user || !supabase) { setCounts({}); return }
    const cached = countCache.get(user.id)
    if (cached) { setCounts(cached); return }

    let cancelled = false
    supabase.rpc('custom_word_counts').then(({ data, error }) => {
      if (cancelled) return
      if (error) { console.warn(`[useCustomWords] counts failed: ${error.message}`); return }
      const next = Object.fromEntries((data ?? []).map(r => [r.list_key, Number(r.n)]))
      countCache.set(user.id, next)
      setCounts(next)
    })
    return () => { cancelled = true }
  }, [user])

  return counts
}

/**
 * The learner's words for the given chapters. Returns `[]` while loading and
 * when signed out, so a caller can concatenate it unconditionally.
 */
export function useCustomWords(listKeys) {
  const { user } = useAuth()
  // The array identity changes on every render at most call sites, so the
  // effect keys on the contents instead.
  const key = [...(listKeys ?? [])].sort().join(',')
  const [words, setWords] = useState([])

  useEffect(() => {
    if (!user || !supabase || !key) { setWords([]); return }
    const wanted = key.split(',')
    const missing = wanted.filter(k => !wordCache.has(`${user.id}|${k}`))

    let cancelled = false
    const settle = () => {
      if (cancelled) return
      setWords(wanted.flatMap(k => wordCache.get(`${user.id}|${k}`) ?? []))
    }

    if (!missing.length) { settle(); return }
    supabase.from('custom_words').select('list_key, payload').in('list_key', missing)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn(`[useCustomWords] load failed: ${error.message}`); return }
        // Cache every requested chapter, including ones that came back empty,
        // so an empty chapter is not re-fetched on every render.
        for (const k of missing) wordCache.set(`${user.id}|${k}`, [])
        for (const row of data ?? []) wordCache.get(`${user.id}|${row.list_key}`)?.push(row.payload)
        settle()
      })
    return () => { cancelled = true }
  }, [user, key])

  return words
}
