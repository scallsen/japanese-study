import { useState, useEffect } from 'react'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function useJaVoices() {
  const [voices, setVoices] = useState([])
  useEffect(() => {
    if (!supported) return
    const update = () => setVoices(speechSynthesis.getVoices().filter(v => v.lang === 'ja-JP'))
    speechSynthesis.addEventListener('voiceschanged', update)
    update()
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

export function useTTS(voiceName = '') {
  function speak(text) {
    if (!supported) return
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.85
    if (voiceName) {
      const voice = speechSynthesis.getVoices().find(v => v.name === voiceName)
      if (voice) utterance.voice = voice
    }
    speechSynthesis.speak(utterance)
  }

  function cancel() {
    if (!supported) return
    speechSynthesis.cancel()
  }

  return { speak, cancel }
}
