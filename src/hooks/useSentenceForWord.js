import { useEffect, useState } from 'react'
import { fetchSentencesFor } from '../utils/sentenceLookup.js'

// Returns the best Tanaka Corpus sentence for a jmdictId, or null if there
// isn't one (or the id/lookup is disabled).
export function useSentenceForWord(id, enabled = true) {
  const sentences = useSentencesForWords(id ? [id] : [], enabled)
  return id ? (sentences[id] ?? null) : null
}

// Batch form for lists of words (e.g. GlanceScreen) — one query covers the
// whole visible set instead of one request per row.
export function useSentencesForWords(ids, enabled = true) {
  const [sentences, setSentences] = useState({})
  const filtered = enabled ? (ids ?? []).filter(Boolean) : []
  const key = filtered.join(',')

  useEffect(() => {
    if (!enabled || filtered.length === 0) return
    let cancelled = false
    fetchSentencesFor(filtered).then(map => {
      if (!cancelled) setSentences(prev => ({ ...prev, ...map }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return sentences
}
