import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const POLL_MS = 30000

// Reflects the single-row `audio_generation_status` table the generate-vocab-audio
// GitHub Actions workflow flips to 'processing' while it runs (see scripts/generate-audio.mjs).
export function useAudioGenerationStatus() {
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    function check() {
      supabase
        .from('audio_generation_status')
        .select('status')
        .eq('id', 'vocab-audio')
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setIsProcessing(data?.status === 'processing')
        })
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { isProcessing }
}
