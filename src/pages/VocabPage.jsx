import { useState, useMemo, useEffect, useRef, Component } from 'react'
import VocabCard from '../components/VocabCard.jsx'
import DrillHUD from '../components/DrillHUD.jsx'
import DrawerSectionHeader from '../components/DrawerSectionHeader.jsx'
import VocabModeToggle from '../components/VocabModeToggle.jsx'
import DrawerCheckbox from '../components/DrawerCheckbox.jsx'
import DrawerSelect from '../components/DrawerSelect.jsx'
import SpeedModeControls from '../components/SpeedModeControls.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SpeakerIcon from '../components/SpeakerIcon.jsx'
import HeaderMenu from '../components/HeaderMenu.jsx'
import SettingsSidebar from '../components/SettingsSidebar.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_BADGE, FS_ENTRY_WORD, FS_STAT_VALUE, FS_DISPLAY_HEADING } from '../data/theme.js'
import { WORD_SOURCES } from '../data/wordLists.js'
import { SENTENCE_SOURCE_OPTIONS, DEFAULT_SENTENCE_SOURCE } from '../data/sentenceSource.js'
import { useDrill } from '../hooks/useDrill.js'
import { useTTS, useJaVoices } from '../hooks/useTTS.js'
import { useSFX } from '../hooks/useSFX.js'
import { useVoicevoxPlayer } from '../hooks/useVoicevoxPlayer.js'
import { useGamepad } from '../hooks/useGamepad.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { useAudioGenerationStatus } from '../hooks/useAudioGenerationStatus.js'
import { useDictionaryEntries } from '../hooks/useDictionaryEntries.js'
import { briefGloss } from '../utils/dictionaryEntryLookup.js'
import { useSentencesForWords } from '../hooks/useSentenceForWord.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js'
import { supabase } from '../lib/supabase.js'
import * as SimpleQueue from '../engines/simpleQueue.js'
import { WORD_DATA } from '../data/wordData.js'
import { createCard } from '../modules/vocab-srs/srs.js'
import { AUDIO_SOURCE_OPTIONS, DEFAULT_AUDIO_SOURCE, getVoicevoxAudioUrl, getVoicevoxCredit, speakerIdFromAudioSource } from '../utils/voicevoxAudio.js'
import AttributionFooter from '../components/AttributionFooter.jsx'
import { renderAttributionSegments } from '../utils/attributionSegments.jsx'

const ACCENT = '#3ABDA4'
const KANJI_FONT = "'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif"

const VOCAB_DRILL_DECK_ID = 'vocab-drill-words'
const MISTAKE_TIER_COLOR = { none: '#4ade80', one: '#fbbf24', many: '#f87171' }

function mistakeTier(count) {
  if (!count) return 'none'
  if (count === 1) return 'one'
  return 'many'
}

// Shared displayForm/reading resolution for word-list rows (DoneScreen,
// GlanceScreen) — dictionary is the source of truth when jmdictId matches
// (see CLAUDE.md's "Dictionary as source of truth" section), the word's own
// kanji/kana are the fallback. reading is null when it'd just repeat displayForm.
function resolveWordDisplay(word, dictEntry) {
  const displayForm = word.kanji ?? dictEntry?.primary_form ?? word.kana
  const readingRaw = word.kana ?? dictEntry?.kana_forms?.[0]
  return { displayForm, reading: readingRaw && readingRaw !== displayForm ? readingRaw : null }
}

function shortPos(raw) {
  if (!raw) return null
  if (raw.startsWith('Godan verb')) return 'v5'
  if (raw.startsWith('Ichidan verb')) return 'v1'
  if (raw.startsWith('suru verb')) return 'vs'
  if (raw.startsWith('adjectival nouns') || raw.startsWith('quasi-adj')) return 'adj-na'
  if (raw.startsWith('adjective')) return 'adj-i'
  if (raw.startsWith('adverb')) return 'adv'
  if (raw.startsWith('noun')) return 'noun'
  if (raw.startsWith('expression')) return 'exp'
  if (raw.startsWith('conjunction')) return 'conj'
  if (raw.startsWith('interjection')) return 'int'
  if (raw.startsWith('auxiliary')) return 'aux'
  if (raw.startsWith('particle')) return 'part'
  if (raw.startsWith('prefix')) return 'pfx'
  if (raw.startsWith('suffix')) return 'sfx'
  if (raw.startsWith('pronoun')) return 'pron'
  if (raw.startsWith('counter')) return 'ctr'
  if (raw.startsWith('numeric')) return 'num'
  return raw.split(' ')[0].slice(0, 6).toLowerCase()
}

function defaultSelectedSource() {
  return safeLocalStorageGet('vocab-selected-source') ?? WORD_SOURCES[0].id
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function useIsShort(breakpoint = 680) {
  const [isShort, setIsShort] = useState(() => window.innerHeight <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-height: ${breakpoint}px)`)
    const handler = e => setIsShort(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isShort
}

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

// Sublist progress is stored per review direction: { [listId]: { [reviewMode]: { lastReviewed, correct, total } } }.
// Entries saved before review modes existed are flat ({ lastReviewed, ... }) — treat those as 'kanji-front' progress
// so old data isn't lost, and 'meaning-front' still reads as unstudied ("New") until reviewed in that direction.
function getSublistModeProgress(vocabProgress, listId, mode) {
  const entry = vocabProgress?.sublists?.[listId]
  if (!entry) return undefined
  if ('lastReviewed' in entry) return mode === 'kanji-front' ? entry : undefined
  return entry[mode]
}

function relativeTime(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── ActiveDrill ───────────────────────────────────────────────────────────────

const AUDIO_PRELOAD_COUNT = 3

function ActiveDrill({ drill, audioSource, sfxEnabled, ttsVoice, showStreak, reviewMode, showFurigana, showTranslation, showSentence, sentenceSource, showKanjiMeaning, pixelFont, showVisualEffects, onPulse, isShort }) {
  const [flippedCardId, setFlippedCardId] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [exitDir, setExitDir] = useState(null)
  const [undoEntering, setUndoEntering] = useState(false)
  const { currentCard, upcoming, streak, bestStreak, correct, troubled, remaining, canUndo, onUndo } = drill
  const isFlipped = flippedCardId === currentCard.id
  const tts = useTTS(ttsVoice)
  const voicevox = useVoicevoxPlayer()

  const nearbyJmdictIds = useMemo(
    () => [currentCard, ...upcoming].map(c => c.word.jmdictId).filter(Boolean),
    [currentCard, upcoming]
  )
  const { entries: nearbyDictEntries } = useDictionaryEntries(nearbyJmdictIds, true)

  function resolveReading(word) {
    return word.kana ?? (word.jmdictId ? nearbyDictEntries[word.jmdictId]?.kana_forms?.[0] : undefined)
  }

  function voicevoxUrlForWord(word) {
    const speakerId = speakerIdFromAudioSource(audioSource)
    return speakerId && word.voicevoxVoices?.includes(speakerId) ? getVoicevoxAudioUrl(speakerId, word.id) : null
  }

  function playWordAudio(word) {
    voicevox.stop()
    const url = voicevoxUrlForWord(word)
    if (url) {
      voicevox.play(url)
    } else if (audioSource === 'browser') {
      const reading = resolveReading(word)
      if (reading) tts.speak(reading)
    }
  }

  function stopWordAudio() {
    tts.cancel()
    voicevox.stop()
  }

  // Preload the current card's audio plus the next few upcoming cards so flipping
  // doesn't wait on a network fetch. Cache is trimmed to the current window each run.
  useEffect(() => {
    const desiredUrls = [currentCard, ...upcoming.slice(0, AUDIO_PRELOAD_COUNT)]
      .map(c => voicevoxUrlForWord(c.word))
      .filter(Boolean)
    voicevox.trimPreload(desiredUrls)
    desiredUrls.forEach(url => voicevox.preload(url))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard.id, audioSource])

  const [localStreak,     setLocalStreak]     = useState(streak)
  const [localBestStreak, setLocalBestStreak] = useState(bestStreak)
  useEffect(() => { setLocalStreak(streak) },     [streak])
  useEffect(() => { setLocalBestStreak(bestStreak) }, [bestStreak])

  const prevLocalStreakRef = useRef(localStreak)
  const [localStreakLost, setLocalStreakLost] = useState(null)
  useEffect(() => {
    const prev = prevLocalStreakRef.current
    prevLocalStreakRef.current = localStreak
    if (prev > 0 && localStreak === 0) {
      setLocalStreakLost('visible')
      const t1 = setTimeout(() => setLocalStreakLost('fading'), 250)
      const t2 = setTimeout(() => setLocalStreakLost(null), 400)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [localStreak])

  const isFlippedRef = useRef(isFlipped)
  const transitioningRef = useRef(false)
  useEffect(() => { isFlippedRef.current = isFlipped }, [isFlipped])
  useEffect(() => { transitioningRef.current = transitioning }, [transitioning])
  const sfx = useSFX()

  const handleVerdictRef = useRef()
  handleVerdictRef.current = (isCorrect) => {
    if (transitioningRef.current) return
    const action = isCorrect ? drill.onCorrect : drill.onWrong
    const breaksBest = !isCorrect && localStreak > 0 && localStreak === localBestStreak
    if (sfxEnabled) sfx.play(
      isCorrect ? 'flip_card_correct' : breaksBest ? 'best_streak_broken' : 'flip_card_wrong',
      isCorrect ? { pitchFactor: 1 + Math.min(localStreak + 1, 20) * 0.03 } : {}
    )
    if (isCorrect) {
      const next = localStreak + 1
      setLocalStreak(next)
      setLocalBestStreak(prev => Math.max(prev, next))
    } else {
      setLocalStreak(0)
    }
    setTransitioning(true)
    setExitDir(isCorrect ? 'up' : 'down')
    onPulse(isCorrect ? 'correct' : 'wrong')
    const exitDelay  = showVisualEffects ? 280 : 0
    const clearDelay = showVisualEffects ? 600 : 0
    setTimeout(() => { action(); setExitDir(null) }, exitDelay)
    setTimeout(() => { setTransitioning(false); onPulse(null) }, clearDelay)
  }

  useEffect(() => {
    if (isFlipped) {
      playWordAudio(currentCard.word)
    } else {
      stopWordAudio()
    }
    return () => stopWordAudio()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, currentCard.id, audioSource])

  useEffect(() => { setFlippedCardId(null) }, [currentCard.id])

  function handleFlip(next) {
    if (sfxEnabled) sfx.play('flip_card')
    setFlippedCardId(next ? currentCard.id : null)
  }

  function handleUndo() {
    if (transitioningRef.current || !canUndo) return
    if (sfxEnabled) sfx.play('undo')
    setFlippedCardId(null)
    setTransitioning(true)
    setExitDir('undo')
    const undoExitDelay  = showVisualEffects ? 200 : 0
    const undoClearDelay = showVisualEffects ? 580 : 0
    setTimeout(() => { onUndo(); setExitDir(null); setUndoEntering(true) }, undoExitDelay)
    setTimeout(() => { setTransitioning(false); setUndoEntering(false) }, undoClearDelay)
  }

  useEffect(() => {
    function onKey(e) {
      if (transitioningRef.current) return
      const t = e.target
      const focusedInteractive = t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'
      if (focusedInteractive) return
      if (t.classList.contains('fc-hover') && (e.code === 'Space' || e.code === 'Enter')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (sfxEnabled) sfx.play('flip_card')
        setFlippedCardId(prev => prev === currentCard.id ? null : currentCard.id)
      } else if (e.code === 'KeyZ' && isFlippedRef.current) {
        handleVerdictRef.current(false)
      } else if (e.code === 'KeyX' && isFlippedRef.current) {
        handleVerdictRef.current(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard.id, drill])

  useGamepad({
    onA: () => {
      if (transitioningRef.current) return
      if (isFlippedRef.current) {
        handleVerdictRef.current(true)
      } else {
        if (sfxEnabled) sfx.play('flip_card')
        setFlippedCardId(currentCard.id)
      }
    },
    onB: () => {
      if (transitioningRef.current || !isFlippedRef.current) return
      handleVerdictRef.current(false)
    },
    onLeftShoulder: () => handleUndo(),
    onRightShoulder: () => playWordAudio(currentCard.word),
  })

  let cardClass = ''
  if (showVisualEffects) {
    if (exitDir === 'up') cardClass = 'card-exit-up'
    else if (exitDir === 'down') cardClass = 'card-exit-down'
    else if (exitDir === 'undo') cardClass = 'card-exit-undo'
    else if (undoEntering) cardClass = 'card-entering-undo'
    else if (transitioning) cardClass = 'card-entering'
  }

  return (
    <DrillHUD
      streak={localStreak}
      bestStreak={localBestStreak}
      streakLost={localStreakLost}
      correct={correct}
      troubled={troubled}
      remaining={remaining}
      canUndo={canUndo}
      onUndo={handleUndo}
      showStreak={showStreak}
      showVisualEffects={showVisualEffects}
      isShort={isShort}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isShort ? 8 : 15 }}>
        <div key={currentCard.id} className={cardClass} style={{ transition: 'width 200ms ease' }}>
          <VocabCard
            word={currentCard.word}
            flipped={isFlipped}
            onFlip={handleFlip}
            animate={showVisualEffects}
            reviewMode={reviewMode}
            showFurigana={showFurigana}
            showTranslation={showTranslation}
            showSentence={showSentence}
            sentenceSource={sentenceSource}
            showKanjiMeaning={showKanjiMeaning}
            pixelFont={pixelFont}
          />
        </div>
        <SpeedModeControls
          isFlipped={isFlipped}
          transitioning={transitioning}
          onVerdict={v => handleVerdictRef.current(v)}
        />
      </div>
    </DrillHUD>
  )
}

function DoneScreen({ pool, mistakeCounts, correct, troubled, onRestart, onRedoTroubled, onRedoSelected, onBack, onAddToSrs }) {
  const rows = useMemo(() =>
    pool
      .map(({ id, word }) => ({ id, word, mistakes: mistakeCounts[id] ?? 0 }))
      .sort((a, b) => b.mistakes - a.mistakes),
    [pool, mistakeCounts]
  )
  const jmdictIds = useMemo(() => rows.map(r => r.word.jmdictId).filter(Boolean), [rows])
  const { entries: dictEntries } = useDictionaryEntries(jmdictIds, true)
  const defaultSelectedIds = useMemo(() => new Set(rows.filter(r => r.mistakes > 0).map(r => r.id)), [rows])
  const [selected, setSelected] = useState(() => new Set(defaultSelectedIds))
  const [addedCount, setAddedCount] = useState(null)
  const selectionChanged = selected.size !== defaultSelectedIds.size || [...selected].some(id => !defaultSelectedIds.has(id))

  const btnBase = {
    padding: '10px 28px',
    fontSize: FS_BASE,
    fontFamily: 'inherit',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleAdd() {
    const words = rows.filter(r => selected.has(r.id)).map(r => r.word)
    if (words.length === 0) return
    setAddedCount(onAddToSrs(words))
  }

  return (
    <div style={{ textAlign: 'center', fontFamily: FONT, width: '100%', maxWidth: 560, padding: '0 24px 48px' }}>
      <div style={{ color: '#fff', fontSize: FS_DISPLAY_HEADING, letterSpacing: '0.05em', marginBottom: 16 }}>Session complete</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: FS_CAPTION, marginBottom: 4 }}>CORRECT</div>
          <div style={{ color: '#fff', fontSize: FS_STAT_VALUE }}>{correct}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: FS_STAT_VALUE, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: troubled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontSize: FS_CAPTION, marginBottom: 4 }}>TROUBLED</div>
          <div style={{ color: troubled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontSize: FS_STAT_VALUE }}>{troubled}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {(troubled > 0 || selectionChanged) && (
          <button
            onClick={() => {
              if (selectionChanged) onRedoSelected(pool.filter(p => selected.has(p.id)))
              else onRedoTroubled()
            }}
            disabled={selectionChanged && selected.size === 0}
            className="done-btn"
            style={{
              ...btnBase,
              background: 'rgba(251,191,36,0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.4)',
              opacity: selectionChanged && selected.size === 0 ? 0.4 : 1,
              cursor: selectionChanged && selected.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {selectionChanged ? `Redo Selected (${selected.size})` : `Redo Troubled (${troubled})`}
          </button>
        )}
        <button
          onClick={onRestart}
          className="done-btn-neutral"
          style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Restart
        </button>
        <button
          onClick={onBack}
          className="done-btn-neutral"
          style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Back to lists
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 36, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>REVIEW WORDS</span>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="done-btn"
              style={{
                ...btnBase,
                padding: '6px 16px',
                fontSize: FS_CAPTION,
                background: selected.size > 0 ? 'rgba(58,189,164,0.15)' : 'rgba(255,255,255,0.04)',
                color: selected.size > 0 ? ACCENT : 'rgba(255,255,255,0.2)',
                border: `1px solid ${selected.size > 0 ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
                cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Add {selected.size} to SRS
            </button>
          </div>
          {addedCount !== null && (
            <div style={{ fontSize: FS_CAPTION, color: ACCENT, marginBottom: 8 }}>
              {addedCount > 0 ? `Added ${addedCount} word${addedCount === 1 ? '' : 's'} to Vocab Drill Words.` : 'Selected words are already in Vocab Drill Words.'}
            </div>
          )}
          <div style={{ background: '#2A2A2A', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {rows.map(row => {
              const dictEntry = row.word.jmdictId ? dictEntries[row.word.jmdictId] : null
              const { displayForm, reading } = resolveWordDisplay(row.word, dictEntry)
              const resolvedEnglish = row.word.english ?? briefGloss(dictEntry)
              return (
                <label
                  key={row.id}
                  className={selected.has(row.id) ? 'vocab-review-row vocab-review-row--selected' : 'vocab-review-row'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: TRACKING,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    style={{ flexShrink: 0, width: 16, height: 16, accentColor: ACCENT }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: MISTAKE_TIER_COLOR[mistakeTier(row.mistakes)], flexShrink: 0 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 100, flexShrink: 0, overflow: 'hidden' }}>
                    <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayForm}
                    </span>
                    {reading && (
                      <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {reading}
                      </span>
                    )}
                  </span>
                  <span style={{
                    fontSize: FS_BASE, color: TEXT_MUTED, flex: 1, minWidth: 0, lineHeight: 1.35,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {resolvedEnglish}
                  </span>
                  {row.mistakes > 0 && (
                    <span style={{ fontSize: FS_BADGE, color: MISTAKE_TIER_COLOR[mistakeTier(row.mistakes)], flexShrink: 0 }}>
                      {row.mistakes}×
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── GlanceScreen ─────────────────────────────────────────────────────────────

class GlanceErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#ff6b6b', fontFamily: FONT, fontSize: FS_BASE }}>
          Preview error: {this.state.error.message}
          <pre style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED, whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function GlanceScreen({ words, availableSubLists, selectedSubLists, sentenceSource }) {
  const jmdictIds = useMemo(() => words.map(w => w.jmdictId).filter(Boolean), [words])
  const { entries: dictEntries } = useDictionaryEntries(jmdictIds, true)
  const tanakaSentences = useSentencesForWords(jmdictIds, true)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedKanji, setExpandedKanji] = useState([])
  const kanjiCache = useRef({})

  async function handleToggleRow(word) {
    const next = expandedId === word.id ? null : word.id
    setExpandedId(next)
    setExpandedKanji([])
    if (!next) return

    const displayForm = word.kanji ?? dictEntries[word.jmdictId]?.primary_form ?? word.kana
    const chars = (displayForm ?? '').split('').filter(ch => /\p{Script=Han}/u.test(ch))
    const missing = chars.filter(ch => !kanjiCache.current[ch])
    if (missing.length > 0 && supabase) {
      const { data } = await supabase
        .from('kanji')
        .select('literal, on_readings, kun_readings, meanings, jlpt, grade, stroke_count')
        .in('literal', missing)
      if (data) {
        for (const k of data) kanjiCache.current[k.literal] = k
      }
    }
    setExpandedKanji(chars.map(ch => kanjiCache.current[ch]).filter(Boolean))
  }

  const grouped = useMemo(() => {
    const order = selectedSubLists.length > 0 ? selectedSubLists : availableSubLists.map(l => l.id)
    return order
      .map(listId => ({
        listId,
        label: availableSubLists.find(l => l.id === listId)?.label ?? listId,
        words: words.filter(w => w.listKey === listId),
      }))
      .filter(g => g.words.length > 0)
  }, [words, selectedSubLists, availableSubLists])

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '32px 24px 48px' }}>
      {grouped.map(group => (
        <div key={group.listId} style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
              {group.label.toUpperCase()}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div style={{ background: '#2A2A2A', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {group.words.map(word => {
            const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
            const tanakaSentence = word.jmdictId ? tanakaSentences[word.jmdictId] : null
            const useTanakaSentence = sentenceSource === 'tanaka' ? !!tanakaSentence : (!word.sentence && !!tanakaSentence)
            const sentenceText = useTanakaSentence ? tanakaSentence.japanese : word.sentence
            const isExpanded = expandedId === word.id
            const { displayForm, reading } = resolveWordDisplay(word, dictEntry)
            const kanjiChars = (displayForm ?? '').split('').filter(ch => /\p{Script=Han}/u.test(ch))
            return (
              <div key={word.id}>
                <button
                  type="button"
                  className="vocab-glance-row"
                  onClick={() => handleToggleRow(word)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: TRACKING,
                    textAlign: 'left',
                    color: 'inherit',
                    transition: 'background 130ms',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>
                        {displayForm}
                      </span>
                      {reading && (
                        <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{reading}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const posLabel = shortPos(Array.isArray(dictEntry?.pos) ? dictEntry.pos[0] : null)
                        return posLabel ? (
                          <span style={{
                            fontSize: FS_BADGE,
                            color: TEXT_MUTED,
                            background: 'rgba(255,255,255,0.07)',
                            borderRadius: 3,
                            padding: '1px 6px',
                            fontFamily: FONT,
                            letterSpacing: TRACKING,
                            flexShrink: 0,
                          }}>{posLabel}</span>
                        ) : null
                      })()}
                      <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                        {dictEntry?.gloss_en?.split('; ').slice(0, 2).join('; ') ?? word.english}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    color: TEXT_MUTED,
                    fontSize: '1.1rem',
                    flexShrink: 0,
                    display: 'inline-block',
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 150ms',
                  }}>›</span>
                </button>

                {isExpanded && (
                  <div style={{
                    padding: '8px 8px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {kanjiChars.length > 0 && (
                      expandedKanji.length > 0 ? (
                        expandedKanji.map(k => (
                          <div key={k.literal} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 14,
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}>
                            <div style={{ fontSize: '2rem', color: TEXT, minWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>
                              {k.literal}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {k.on_readings?.length > 0 && (
                                <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 2 }}>
                                  {k.on_readings.join('　')}
                                </div>
                              )}
                              {k.kun_readings?.length > 0 && (
                                <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 4 }}>
                                  {k.kun_readings.join('　')}
                                </div>
                              )}
                              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>
                                {(k.meanings ?? '').split('; ').slice(0, 4).join(', ')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                              {k.jlpt != null && (
                                <span style={{
                                  fontSize: FS_BADGE,
                                  padding: '2px 6px',
                                  background: 'rgba(58,189,164,0.12)',
                                  color: ACCENT,
                                  border: '1px solid rgba(58,189,164,0.2)',
                                  borderRadius: 3,
                                }}>N{k.jlpt}</span>
                              )}
                              {k.stroke_count != null && (
                                <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED }}>{k.stroke_count} strokes</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, padding: '6px 0' }}>Loading…</div>
                      )
                    )}
                    {sentenceText && (
                      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontStyle: 'italic', padding: '2px 0' }}>
                        {sentenceText}
                      </div>
                    )}
                    {dictEntry && (
                      <a
                        href={`#/dictionary/entry/${dictEntry.id}`}
                        className="srs-browse-link"
                        style={{ fontSize: FS_CAPTION, color: ACCENT, alignSelf: 'flex-start', marginTop: 2 }}
                      >
                        View full entry →
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

function HomeScreen({ selectedSourceId, onSelectSource, availableSubLists, selectedSubLists, onToggleSubList, wordCountByList, hasReviewWords, includeReview, onToggleIncludeReview, vocabProgress, reviewMode, onChangeReviewMode, onStart, onGlance }) {
  const [startHovered, setStartHovered] = useState(false)
  const canStart = selectedSubLists.length > 0

  return (
    <div style={{
      width: '100%',
      maxWidth: 680,
      margin: '0 auto',
      padding: '32px 24px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>

      {/* Direction */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>
          DRILL MODE
        </label>
        <VocabModeToggle mode={reviewMode} onChange={onChangeReviewMode} />
      </div>

      {/* Source selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>
          WORD LIST
        </label>
      <select
        value={selectedSourceId}
        onChange={e => onSelectSource(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 36px 8px 12px',
          fontSize: FS_BASE,
          fontFamily: 'inherit',
          letterSpacing: TRACKING,
          background: 'rgba(255,255,255,0.06)',
          color: TEXT,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6,
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}
      >
        {WORD_SOURCES.map(source => (
          <option key={source.id} value={source.id}>{source.label}</option>
        ))}
      </select>
      {hasReviewWords && (
        <div style={{ marginTop: 4 }}>
          <DrawerCheckbox checked={includeReview} onChange={onToggleIncludeReview} label="Include review words" />
        </div>
      )}
      </div>

      {/* Sublist grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 6 }}>
        {availableSubLists.map(list => {
          const count = wordCountByList[list.id] ?? 0
          const prog = getSublistModeProgress(vocabProgress, list.id, reviewMode)
          const isSelected = selectedSubLists.includes(list.id)
          return (
            <SubListTile
              key={list.id}
              label={list.label}
              wordCount={count}
              progress={prog}
              selected={isSelected}
              onClick={() => onToggleSubList(list.id)}
            />
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={canStart ? onStart : undefined}
          onMouseEnter={() => setStartHovered(true)}
          onMouseLeave={() => setStartHovered(false)}
          style={{
            padding: '11px 28px',
            fontSize: FS_BASE,
            fontFamily: 'inherit',
            letterSpacing: TRACKING,
            borderRadius: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
            background: canStart
              ? startHovered ? 'rgba(58,189,164,0.25)' : 'rgba(58,189,164,0.15)'
              : 'rgba(255,255,255,0.04)',
            color: canStart ? ACCENT : 'rgba(255,255,255,0.2)',
            border: `1px solid ${canStart ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
            transition: 'background 130ms, color 130ms, border-color 130ms',
          }}
        >
          Start review
          {selectedSubLists.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: FS_CAPTION, opacity: 0.7 }}>
              ({selectedSubLists.reduce((sum, id) => sum + (wordCountByList[id] ?? 0), 0)} words)
            </span>
          )}
        </button>

        <button
          className={canStart ? 'vocab-glance-btn' : undefined}
          onClick={canStart ? onGlance : undefined}
          style={{
            padding: '11px 28px',
            fontSize: FS_BASE,
            fontFamily: 'inherit',
            letterSpacing: TRACKING,
            borderRadius: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
            background: canStart ? undefined : 'rgba(255,255,255,0.03)',
            color: canStart ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)',
            border: `1px solid ${canStart ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'background 130ms',
            opacity: canStart ? 1 : 0.5,
            pointerEvents: canStart ? 'auto' : 'none',
          }}
        >
          Preview
        </button>

        <button
          disabled
          style={{
            padding: '11px 28px',
            fontSize: FS_BASE,
            fontFamily: 'inherit',
            letterSpacing: TRACKING,
            borderRadius: 8,
            cursor: 'not-allowed',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: 0.5,
          }}
        >
          Send to SRS
        </button>
      </div>
    </div>
  )
}

function SubListTile({ label, wordCount, progress, selected, onClick }) {
  const [hovered, setHovered] = useState(false)
  const timeAgo = relativeTime(progress?.lastReviewed)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        width: '100%',
        minHeight: 54,
        padding: '10px 12px',
        background: selected
          ? 'rgba(255,255,255,0.1)'
          : hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: TRACKING,
        transition: 'background 130ms, border-color 130ms',
      }}
    >
      <span style={{ fontSize: FS_BASE, color: selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}>
        {label}
      </span>
      <span style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {wordCount} words
        {!progress ? (
          <span style={{
            fontSize: FS_BADGE,
            padding: '1px 5px',
            background: 'rgba(58,189,164,0.12)',
            color: 'rgba(58,189,164,0.65)',
            border: '1px solid rgba(58,189,164,0.2)',
            borderRadius: 3,
            letterSpacing: '0.06em',
          }}>New</span>
        ) : timeAgo ? (
          <>
            <span>·</span>
            {timeAgo}
          </>
        ) : null}
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabPage() {
  const { user, signIn, signOut, loading: authLoading } = useAuth()
  const { data: vocabProgress, save: saveVocabProgress } = useProgress('vocab-flashcard')
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')

  const [showOptions,       setShowOptions]       = useState(() => window.innerWidth > 768)
  const [selectedSourceId,  setSelectedSourceId]  = useState(defaultSelectedSource)
  const [selectedSubLists,  setSelectedSubLists]  = useState([])
  const [reviewMode,       setReviewMode]       = useState(() => safeLocalStorageGet('vocab-review-mode') ?? 'kanji-front')
  const [isDrilling,       setIsDrilling]       = useState(false)
  const [isGlancing,       setIsGlancing]       = useState(false)
  const [audioEnabled,     setAudioEnabled]     = useState(() => {
    const s = safeLocalStorageGet('vocab-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [audioSource,      setAudioSource]      = useState(() => safeLocalStorageGet('vocab-audio-source') ?? DEFAULT_AUDIO_SOURCE)
  const [sfxEnabled,       setSfxEnabled]       = useState(() => {
    const s = safeLocalStorageGet('vocab-sfx-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsVoice,         setTtsVoice]         = useState(() => safeLocalStorageGet('vocab-tts-voice') ?? '')
  const [showStreak,       setShowStreak]       = useState(() => {
    const s = safeLocalStorageGet('vocab-show-streak'); return s === null ? true : s === 'true'
  })
  const [showFurigana,     setShowFurigana]     = useState(() => {
    const s = safeLocalStorageGet('vocab-show-furigana'); return s === null ? true : s === 'true'
  })
  const [showVisualEffects, setShowVisualEffects] = useState(() => {
    const s = safeLocalStorageGet('vocab-visual-effects'); return s === null ? true : s === 'true'
  })
  const [pixelFont,        setPixelFont]        = useState(() => {
    const s = safeLocalStorageGet('vocab-pixel-font'); return s === null ? true : s === 'true'
  })
  const [showTranslation,  setShowTranslation]  = useState(() => {
    const s = safeLocalStorageGet('vocab-show-translation'); return s === null ? true : s === 'true'
  })
  const [showSentence,     setShowSentence]     = useState(() => {
    const s = safeLocalStorageGet('vocab-show-sentence'); return s === null ? false : s === 'true'
  })
  const [sentenceSource, setSentenceSource] = useState(() => safeLocalStorageGet('vocab-sentence-source') ?? DEFAULT_SENTENCE_SOURCE)
  const [showKanjiMeaning, setShowKanjiMeaning] = useState(() => {
    const s = safeLocalStorageGet('vocab-show-kanji-meaning'); return s === null ? false : s === 'true'
  })
  const [includeReview, setIncludeReview] = useState(() => {
    const s = safeLocalStorageGet('vocab-include-review'); return s === null ? true : s === 'true'
  })
  const [pulseColor,       setPulseColor]       = useState(null)
  const [headerHeight,     setHeaderHeight]     = useState(72)
  const headerRef   = useRef(null)
  const [optionsHovered, setOptionsHovered] = useState(false)
  const isMobile = useIsMobile()
  const isShort  = useIsShort()
  const jaVoices = useJaVoices()
  const { isProcessing: audioProcessing } = useAudioGenerationStatus()

  useEffect(() => { safeLocalStorageSet('vocab-selected-source', selectedSourceId) }, [selectedSourceId])
  useEffect(() => { safeLocalStorageSet('vocab-review-mode',     reviewMode) },       [reviewMode])
  useEffect(() => { safeLocalStorageSet('vocab-audio-enabled',  audioEnabled) },     [audioEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-audio-source',   audioSource) },      [audioSource])
  useEffect(() => { safeLocalStorageSet('vocab-sfx-enabled',    sfxEnabled) },       [sfxEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-tts-voice',      ttsVoice) },         [ttsVoice])
  useEffect(() => { safeLocalStorageSet('vocab-show-streak',    showStreak) },       [showStreak])
  useEffect(() => { safeLocalStorageSet('vocab-show-furigana',  showFurigana) },     [showFurigana])
  useEffect(() => { safeLocalStorageSet('vocab-visual-effects', showVisualEffects) },[showVisualEffects])
  useEffect(() => { safeLocalStorageSet('vocab-pixel-font',     pixelFont) },        [pixelFont])
  useEffect(() => { safeLocalStorageSet('vocab-show-translation', showTranslation) },[showTranslation])
  useEffect(() => { safeLocalStorageSet('vocab-show-sentence',    showSentence) },   [showSentence])
  useEffect(() => { safeLocalStorageSet('vocab-sentence-source', sentenceSource) }, [sentenceSource])
  useEffect(() => { safeLocalStorageSet('vocab-show-kanji-meaning', showKanjiMeaning) }, [showKanjiMeaning])
  useEffect(() => { safeLocalStorageSet('vocab-include-review', includeReview) }, [includeReview])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const availableSubLists = useMemo(() => {
    const source = WORD_SOURCES.find(s => s.id === selectedSourceId)
    return source?.lists ?? [{ id: source?.id, label: source?.label }]
  }, [selectedSourceId])

  const hasReviewWords = useMemo(() => {
    const sourceListKeys = new Set(availableSubLists.map(l => l.id))
    return WORD_DATA.some(w => sourceListKeys.has(w.listKey) && w.isReview)
  }, [availableSubLists])

  const wordCountByList = useMemo(() => {
    const map = {}
    for (const w of WORD_DATA) {
      if (!includeReview && w.isReview) continue
      map[w.listKey] = (map[w.listKey] ?? 0) + 1
    }
    return map
  }, [includeReview])

  const glanceWords = useMemo(() =>
    WORD_DATA.filter(w => selectedSubLists.includes(w.listKey) && (includeReview || !w.isReview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(','), includeReview]
  )

  const pool = useMemo(() =>
    glanceWords.map(w => ({ id: w.id, word: w })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(','), includeReview]
  )

  const drill = useDrill(pool, { engine: SimpleQueue })

  // Warm the shared dictionary-entry cache for the whole selected pool as
  // soon as it's chosen — well before "Start Drill" — so ActiveDrill/
  // DoneScreen/GlanceScreen's own useDictionaryEntries calls resolve from
  // cache instead of flashing a loading state per card.
  const poolJmdictIds = useMemo(() => pool.map(p => p.word.jmdictId).filter(Boolean), [pool])
  const { entries: poolDictEntries } = useDictionaryEntries(poolJmdictIds, true)

  // Save progress when session completes
  useEffect(() => {
    if (!isDrilling || !drill.done || !user) return
    const now = new Date().toISOString()
    const total = pool.length
    const updatedSublists = { ...(vocabProgress?.sublists ?? {}) }
    for (const listId of selectedSubLists) {
      const existing = updatedSublists[listId]
      const existingByMode = existing && 'lastReviewed' in existing ? { 'kanji-front': existing } : (existing ?? {})
      updatedSublists[listId] = {
        ...existingByMode,
        [reviewMode]: { lastReviewed: now, correct: drill.correct, total },
      }
    }
    saveVocabProgress({ ...(vocabProgress ?? {}), sublists: updatedSublists })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.done, isDrilling, user, reviewMode])

  function handleAddToSrs(words) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = { ...current.decks }
    if (!decks[VOCAB_DRILL_DECK_ID]) {
      decks[VOCAB_DRILL_DECK_ID] = { id: VOCAB_DRILL_DECK_ID, name: 'Vocab Drill Words', active: true, source: 'imported', addedAt: Date.now() }
    }
    const existingFronts = new Set(
      Object.values(current.cards)
        .filter(c => c.deckId === VOCAB_DRILL_DECK_ID)
        .map(c => c.front)
    )
    const newCards = {}
    let addedCount = 0
    words.forEach((word, i) => {
      const dictEntry = word.jmdictId ? poolDictEntries[word.jmdictId] : null
      const front = word.kanji ?? dictEntry?.primary_form ?? word.kana
      if (existingFronts.has(front)) return
      existingFronts.add(front)
      const cardId = `${VOCAB_DRILL_DECK_ID}-${Date.now()}-${i}`
      const kana = word.kana ?? dictEntry?.kana_forms?.[0]
      const english = word.english ?? briefGloss(dictEntry)
      const extras = {}
      if (kana) extras.kana = kana
      if (word.sentence) extras.sentence = word.sentence
      if (word.jmdictId) extras.jmdictId = word.jmdictId
      if (word.voicevoxVoices?.length) {
        extras.voicevoxVoices = word.voicevoxVoices
        extras.voicevoxId = word.id
      }
      newCards[cardId] = createCard(front, english, cardId, VOCAB_DRILL_DECK_ID, extras)
      addedCount++
    })
    if (addedCount > 0) {
      saveSrs({ ...current, decks, cards: { ...current.cards, ...newCards } })
    }
    return addedCount
  }

  function handleSelectSource(sourceId) {
    if (sourceId === selectedSourceId) return
    setSelectedSourceId(sourceId)
    setSelectedSubLists([])
  }

  function renderPanelContent(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>

        <DrawerSectionHeader title="Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DrawerCheckbox checked={showStreak}        onChange={() => setShowStreak(v => !v)}        label="Show streak" />
          <DrawerCheckbox checked={showFurigana}      onChange={() => setShowFurigana(v => !v)}      label="Show furigana" />
          <DrawerCheckbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <DrawerCheckbox checked={pixelFont}         onChange={() => setPixelFont(v => !v)}         label="Use pixel font" />
          <DrawerCheckbox checked={showTranslation}   onChange={() => setShowTranslation(v => !v)}   label="Show translation" />
          <DrawerCheckbox checked={showSentence}      onChange={() => setShowSentence(v => !v)}       label="Show sentence" />
          {showSentence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
              <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Sentence source</span>
              <DrawerSelect
                value={sentenceSource}
                onChange={setSentenceSource}
                options={SENTENCE_SOURCE_OPTIONS}
                label="Sentence source"
              />
            </div>
          )}
          <DrawerCheckbox checked={showKanjiMeaning}  onChange={() => setShowKanjiMeaning(v => !v)}   label="Show kanji meaning" />
          <DrawerCheckbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Text to speech</span>
                <DrawerSelect
                  value={audioSource}
                  onChange={setAudioSource}
                  options={AUDIO_SOURCE_OPTIONS}
                  label="Text to speech"
                />
                {getVoicevoxCredit(audioSource) && (
                  <span style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)' }}>{renderAttributionSegments(getVoicevoxCredit(audioSource))}</span>
                )}
                {audioProcessing && (
                  <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Audio is being generated</span>
                )}
                {audioSource === 'browser' && jaVoices.length > 0 && (
                  <DrawerSelect
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </div>
              <DrawerCheckbox
                checked={sfxEnabled}
                onChange={() => setSfxEnabled(v => !v)}
                label="Sound effects"
                subtext="Silent mode may mute sound effects"
                indent={1}
              />
            </>
          )}
        </div>

      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      position: 'relative',
      width: '100vw',
      height: '100dvh',
      background: '#1E1E1E',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      overflow: 'hidden',
    }}>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>

        {/* Verdict pulse */}
        <div
          className={showVisualEffects && pulseColor ? `stage-pulse-${pulseColor}` : ''}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        />

        {/* Header */}
        <div ref={headerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <PageHeader
            crumbs={
              isDrilling && !drill.done
                ? [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training', onClick: () => setIsDrilling(false) }, { label: 'Reviewing' }]
                : isGlancing
                ? [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training', onClick: () => setIsGlancing(false) }, { label: 'Preview' }]
                : [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training' }]
            }
            rightSlot={<HeaderMenu
              primary={
                <button
                  onClick={() => setShowOptions(v => !v)}
                  onMouseEnter={() => setOptionsHovered(true)}
                  onMouseLeave={() => setOptionsHovered(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 34, padding: '0 12px', fontSize: FS_BASE,
                    fontFamily: 'inherit',
                    background: optionsHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'background 130ms',
                  }}
                >
                  Options
                </button>
              }
              items={[
                {
                  label: audioEnabled ? 'Mute' : 'Unmute',
                  icon: <SpeakerIcon muted={!audioEnabled} size={20} />,
                  onClick: () => setAudioEnabled(v => !v),
                  dim: !audioEnabled,
                },
                ...(!authLoading ? [{
                  label: user ? 'Sign out' : 'Sign in',
                  onClick: user ? signOut : signIn,
                }] : []),
              ]}
            />}
          />
          {isDrilling && !drill.done && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                height: '100%',
                width: `${(drill.correct + drill.remaining) > 0 ? (drill.correct / (drill.correct + drill.remaining)) * 100 : 0}%`,
                background: '#3ABDA4',
                transition: 'width 300ms ease',
              }} />
            </div>
          )}
        </div>

        {/* Center content */}
        <div style={{
          position: 'absolute', top: headerHeight, left: 0, right: 0,
          height: `calc(100dvh - ${headerHeight}px)`,
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          zIndex: 2,
        }}>
          <div style={{
            flex: 1, width: '100%',
            display: 'flex', alignItems: isDrilling ? 'center' : 'flex-start', justifyContent: 'center',
            minHeight: 'min-content',
          }}>
            {isDrilling ? (
              drill.done ? (
                <DoneScreen
                  pool={pool}
                  mistakeCounts={drill.mistakeCounts}
                  correct={drill.correct}
                  troubled={drill.troubled}
                  onRestart={drill.restart}
                  onRedoTroubled={drill.redoTroubled}
                  onRedoSelected={drill.redoSelection}
                  onBack={() => setIsDrilling(false)}
                  onAddToSrs={handleAddToSrs}
                />
              ) : (
                <ActiveDrill
                  drill={drill}
                  audioSource={audioEnabled ? audioSource : 'none'}
                  sfxEnabled={audioEnabled && sfxEnabled}
                  ttsVoice={ttsVoice}
                  showStreak={showStreak}
                  reviewMode={reviewMode}
                  showFurigana={showFurigana}
                  showTranslation={showTranslation}
                  showSentence={showSentence}
                  sentenceSource={sentenceSource}
                  showKanjiMeaning={showKanjiMeaning}
                  pixelFont={pixelFont}
                  showVisualEffects={showVisualEffects}
                  onPulse={setPulseColor}
                  isShort={isShort}
                />
              )
            ) : isGlancing ? (
              <GlanceErrorBoundary>
                <GlanceScreen
                  words={glanceWords}
                  availableSubLists={availableSubLists}
                  selectedSubLists={selectedSubLists}
                  sentenceSource={sentenceSource}
                />
              </GlanceErrorBoundary>
            ) : (
              <HomeScreen
                selectedSourceId={selectedSourceId}
                onSelectSource={handleSelectSource}
                availableSubLists={availableSubLists}
                selectedSubLists={selectedSubLists}
                onToggleSubList={id => setSelectedSubLists(prev => toggle(prev, id))}
                wordCountByList={wordCountByList}
                hasReviewWords={hasReviewWords}
                includeReview={includeReview}
                onToggleIncludeReview={() => setIncludeReview(v => !v)}
                vocabProgress={vocabProgress}
                reviewMode={reviewMode}
                onChangeReviewMode={setReviewMode}
                onStart={() => setIsDrilling(true)}
                onGlance={() => setIsGlancing(true)}
              />
            )}
          </div>
          <AttributionFooter sources={[
            'dictionary',
            'tanaka-corpus',
            ...(audioEnabled && speakerIdFromAudioSource(audioSource) ? ['voicevox'] : []),
          ]} />
        </div>
      </div>

      <SettingsSidebar
        open={showOptions}
        onToggle={() => setShowOptions(v => !v)}
        onClose={() => setShowOptions(false)}
        isMobile={isMobile}
      >
        {paddingH => renderPanelContent(paddingH)}
      </SettingsSidebar>

    </div>
  )
}
