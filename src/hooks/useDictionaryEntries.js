import { useEffect, useState } from 'react'
import { fetchDictionaryEntries } from '../utils/dictionaryEntryLookup.js'

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
