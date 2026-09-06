import { useEffect, useState } from 'react'
import { fetchDictionaryEntries, fetchSenseGlosses } from '../utils/dictionaryEntryLookup.js'

// ids: array of jmdictId (nullish entries are filtered out).
// Returns { entries: { [id]: row|null }, loading } — `loading` is true while
// any requested id hasn't resolved yet, distinct from an id simply having no
// jmdictId (which never enters `filtered` and so never contributes to loading).
export function useDictionaryEntries(ids, enabled = true) {
  const [entries, setEntries] = useState({})
  const filtered = enabled ? (ids ?? []).filter(Boolean) : []
  const key = filtered.join(',')

  useEffect(() => {
    if (!enabled || filtered.length === 0) return
    let cancelled = false
    fetchDictionaryEntries(filtered).then(map => {
      if (!cancelled) setEntries(prev => ({ ...prev, ...map }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const loading = filtered.some(id => !(id in entries))
  return { entries, loading }
}

// Single-word convenience wrapper. Returns { entry: row|null, loading } — an
// id-less word (no jmdictId) resolves immediately with loading: false.
export function useDictionaryEntry(id, enabled = true) {
  const { entries, loading } = useDictionaryEntries(id ? [id] : [], enabled)
  if (!id) return { entry: null, loading: false }
  return { entry: entries[id] ?? null, loading }
}

// words: array of word objects. Only those naming a sense (`word.sense`) are
// looked up — for everything else cardGloss uses the entry's leading glosses
// and this fetches nothing at all. Returns { [jmdictId]: gloss[][] }, the shape
// cardGloss's third argument expects.
export function useSenseGlosses(words, enabled = true) {
  const [senseGlosses, setSenseGlosses] = useState({})
  const ids = enabled
    ? [...new Set((words ?? []).filter(w => w?.sense != null && w.jmdictId).map(w => w.jmdictId))]
    : []
  const key = ids.join(',')

  useEffect(() => {
    if (!enabled || ids.length === 0) return
    let cancelled = false
    fetchSenseGlosses(ids).then(map => {
      if (!cancelled) setSenseGlosses(prev => ({ ...prev, ...map }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return senseGlosses
}
