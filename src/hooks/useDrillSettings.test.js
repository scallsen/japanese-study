import { describe, it, expect, beforeEach } from 'vitest'
import { initialDrillSettings, audioSourceForVoice, DRILL_SETTINGS_DEFAULTS } from './useDrillSettings.js'

// safeLocalStorageGet reads the bare `localStorage` global; this repo has no
// jsdom, so stand one up with just the methods the storage helpers touch.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k, String(v)]))
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
  }
}

function withStorage(entries) {
  globalThis.localStorage = fakeStorage(entries)
}

beforeEach(() => { withStorage({}) })

describe('audioSourceForVoice', () => {
  it('maps the named voices onto their speaker ids', () => {
    expect(audioSourceForVoice('female')).toBe('voicevox-2')
    expect(audioSourceForVoice('male')).toBe('voicevox-11')
  })
})

describe('initialDrillSettings', () => {
  it('falls back to the defaults for a fresh install', () => {
    expect(initialDrillSettings('vocab')).toEqual(DRILL_SETTINGS_DEFAULTS)
  })

  it('prefers stored new-shape keys over any migration', () => {
    withStorage({ 'vocab-front-audio': 'true', 'vocab-audio-enabled': 'false', 'vocab-voice': 'female' })
    const s = initialDrillSettings('vocab')
    expect(s.frontAudio).toBe(true)
    expect(s.voice).toBe('female')
  })

  it('migrates Vocab Drill audio, which only ever played on flip', () => {
    withStorage({ 'vocab-audio-enabled': 'true' })
    expect(initialDrillSettings('vocab')).toMatchObject({ frontAudio: false, backAudio: true })

    withStorage({ 'vocab-audio-enabled': 'false' })
    expect(initialDrillSettings('vocab')).toMatchObject({ frontAudio: false, backAudio: false })
  })

  it('migrates SRS autoplay flags onto the two faces', () => {
    withStorage({
      'srs-audio-enabled': 'true',
      'srs-autoplay-audio': 'true',
      'srs-autoplay-front': 'false',
      'srs-autoplay-back': 'true',
    })
    expect(initialDrillSettings('srs')).toMatchObject({ frontAudio: false, backAudio: true })
  })

  it('treats the SRS auto-play parent as gating both faces', () => {
    withStorage({
      'srs-audio-enabled': 'true',
      'srs-autoplay-audio': 'false',
      'srs-autoplay-front': 'true',
      'srs-autoplay-back': 'true',
    })
    expect(initialDrillSettings('srs')).toMatchObject({ frontAudio: false, backAudio: false })
  })

  it('migrates the recorded voice, and keeps the browser voice as the backup', () => {
    withStorage({ 'vocab-audio-source': 'voicevox-2', 'vocab-tts-voice': 'Kyoko' })
    expect(initialDrillSettings('vocab')).toMatchObject({ voice: 'female', backupVoice: 'Kyoko' })
  })

  it('drops the retired browser source back to the default recorded voice', () => {
    withStorage({ 'vocab-audio-source': 'browser', 'vocab-tts-voice': 'Otoya' })
    expect(initialDrillSettings('vocab')).toMatchObject({ voice: 'male', backupVoice: 'Otoya' })
  })

  it('keeps the display settings each drill already had', () => {
    withStorage({ 'srs-show-furigana': 'false', 'srs-show-kanji-meaning': 'true' })
    expect(initialDrillSettings('srs')).toMatchObject({ furigana: false, kanjiMeanings: true })
  })
})
