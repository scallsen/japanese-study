// Shared between VocabPage and VocabSrsDrill/VocabSrsModule — keeps the speaker
// id <-> audio-source-setting mapping and Supabase Storage URL construction in one place.

import { ATTRIBUTIONS } from '../data/attributions.js'

export const VOICEVOX_VOICES = [
  { id: 2, name: 'shikoku-metan', label: 'Female (Shikoku Metan)', credit: ATTRIBUTIONS['voicevox-2'] },
  { id: 11, name: 'kurono-takehiro', label: 'Male (Kurono Takehiro)', credit: ATTRIBUTIONS['voicevox-11'] },
]

export const AUDIO_SOURCE_OPTIONS = [
  ...VOICEVOX_VOICES.map(v => ({ value: `voicevox-${v.id}`, label: v.label })),
  { value: 'browser', label: 'Browser TTS' },
]

export const DEFAULT_AUDIO_SOURCE = 'voicevox-11' // Male (Kurono Takehiro)

const VOICEVOX_AUDIO_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/audio/voicevox`
  : null

export function getVoicevoxAudioUrl(speakerId, entryId) {
  return speakerId && entryId && VOICEVOX_AUDIO_BASE ? `${VOICEVOX_AUDIO_BASE}/${speakerId}/${entryId}.mp3` : null
}

// 'voicevox-2' -> 2, 'browser' / 'none' -> null
export function speakerIdFromAudioSource(audioSource) {
  const match = audioSource?.match(/^voicevox-(\d+)$/)
  return match ? Number(match[1]) : null
}

// Credit segments (see attributions.js) for the currently selected voice, or
// null for 'browser'/'none' — render with renderAttributionSegments().
export function getVoicevoxCredit(audioSource) {
  const speakerId = speakerIdFromAudioSource(audioSource)
  return VOICEVOX_VOICES.find(v => v.id === speakerId)?.credit ?? null
}
