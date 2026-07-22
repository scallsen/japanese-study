import { useEffect, useState } from 'react'
import { kanjiCharsOf, fetchKanjiMeanings } from '../utils/kanjiMeaningLookup.js'

export function useKanjiMeanings(kanjiStr, enabled) {
  const [meanings, setMeanings] = useState({})
  const chars = enabled ? kanjiCharsOf(kanjiStr) : []
  const key = chars.join('')

  useEffect(() => {
    if (!enabled || chars.length === 0) return
    let cancelled = false
    fetchKanjiMeanings(chars).then(map => {
      if (!cancelled) setMeanings(prev => ({ ...prev, ...map }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return meanings
}
