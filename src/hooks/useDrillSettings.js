import { useState, useEffect } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js'

// One settings model for every card drill — Vocab Drill, Anime Vocab and SRS
// each used to keep their own near-identical copy, and the labels had already
// drifted apart. Grouped the way the panel presents them: what the front
// shows, what the back shows, the voice, and app chrome.
//
// Audio is per face rather than one master switch plus autoplay flags:
// playing the word is one of the things a face does, so `frontAudio` plays it
// when the card appears and `backAudio` when it flips. `voice` picks between
// the two recorded Voicevox voices; `backupVoice` is the browser voice that
// reads anything with no recording, which is what the code always did
// silently.
export const DRILL_SETTINGS_DEFAULTS = {
  furigana: true,
  frontAudio: false,
  translation: true,
  kanjiMeanings: false,
  sentence: true,
  backAudio: true,
  voice: 'male',
  backupVoice: '',
  sfx: true,
  pixelFont: true,
  visualEffects: true,
  streak: true,
}

// 'male'/'female' -> the audio-source string the drills and voicevoxAudio.js
// still speak. The panel names voices; the storage layer names speakers.
export function audioSourceForVoice(voice) {
  return voice === 'female' ? 'voicevox-2' : 'voicevox-11'
}

const BOOL_KEYS = {
  furigana: 'show-furigana',
  frontAudio: 'front-audio',
  translation: 'show-translation',
  kanjiMeanings: 'show-kanji-meaning',
  sentence: 'show-sentence',
  backAudio: 'back-audio',
  sfx: 'sfx-enabled',
  pixelFont: 'pixel-font',
  visualEffects: 'visual-effects',
  streak: 'show-streak',
}

const STRING_KEYS = {
  voice: 'voice',
  backupVoice: 'backup-voice',
}

function readBool(key, fallback) {
  const raw = safeLocalStorageGet(key)
  return raw === null ? fallback : raw === 'true'
}

// The old shape, read only when the new keys are absent. Audio was one
// `audio-enabled` master plus (in SRS) autoplay-front/back; the source was a
// single picker that mixed the two recordings with the browser voice.
function migrateAudio(prefix) {
  const enabled = readBool(`${prefix}-audio-enabled`, true)
  if (prefix === 'srs') {
    const autoplay = readBool('srs-autoplay-audio', true)
    return {
      frontAudio: enabled && autoplay && readBool('srs-autoplay-front', true),
      backAudio: enabled && autoplay && readBool('srs-autoplay-back', true),
    }
  }
  // Vocab Drill and Anime Vocab only ever played on flip.
  return { frontAudio: false, backAudio: enabled }
}

function migrateVoice(prefix) {
  const source = safeLocalStorageGet(`${prefix}-audio-source`)
  // 'browser' had no recorded voice of its own; the browser voice it selected
  // survives as the backup, and the recorded voice falls back to its default.
  return source === 'voicevox-2' ? 'female' : DRILL_SETTINGS_DEFAULTS.voice
}

function readInitial(prefix) {
  const migratedAudio = migrateAudio(prefix)
  const settings = {}

  for (const [name, suffix] of Object.entries(BOOL_KEYS)) {
    const key = `${prefix}-${suffix}`
    const stored = safeLocalStorageGet(key)
    if (stored !== null) {
      settings[name] = stored === 'true'
    } else if (name in migratedAudio) {
      settings[name] = migratedAudio[name]
    } else {
      settings[name] = DRILL_SETTINGS_DEFAULTS[name]
    }
  }

  settings.voice = safeLocalStorageGet(`${prefix}-${STRING_KEYS.voice}`) ?? migrateVoice(prefix)
  settings.backupVoice = safeLocalStorageGet(`${prefix}-${STRING_KEYS.backupVoice}`)
    ?? safeLocalStorageGet(`${prefix}-tts-voice`)
    ?? DRILL_SETTINGS_DEFAULTS.backupVoice

  return settings
}

// Exported for the unit test — the migration is the part worth pinning down,
// and it is pure given a storage prefix.
export function initialDrillSettings(prefix) {
  return readInitial(prefix)
}

/**
 * @param {'vocab'|'srs'} prefix  localStorage namespace. Vocab Drill and
 *   Anime Vocab deliberately share 'vocab' — they always have, and they are
 *   the same drill over different words.
 */
export function useDrillSettings(prefix) {
  const [settings, setSettings] = useState(() => readInitial(prefix))

  useEffect(() => {
    for (const [name, suffix] of Object.entries(BOOL_KEYS)) {
      safeLocalStorageSet(`${prefix}-${suffix}`, settings[name])
    }
    for (const [name, suffix] of Object.entries(STRING_KEYS)) {
      safeLocalStorageSet(`${prefix}-${suffix}`, settings[name])
    }
  }, [prefix, settings])

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return { settings, set }
}
