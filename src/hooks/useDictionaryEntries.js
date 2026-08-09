import { useEffect, useState } from 'react'
import { fetchDictionaryEntries } from '../utils/dictionaryEntryLookup.js'

// ids: array of jmdictId (nullish entries are filtered out). Returns { [id]: row|null }.
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

  return entries
}

// Single-word convenience wrapper — returns the row (or null) for one jmdictId.
export function useDictionaryEntry(id, enabled = true) {
  const entries = useDictionaryEntries(id ? [id] : [], enabled)
  return id ? (entries[id] ?? null) : null
}
