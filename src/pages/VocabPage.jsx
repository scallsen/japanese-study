import { useState, useMemo, useEffect, useRef, Component } from 'react'
import VocabCard from '../components/VocabCard.jsx'
import DrillHUD from '../components/DrillHUD.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import ChipSelector from '../components/Chip.jsx'
import Checkbox from '../components/Checkbox.jsx'
import Select from '../components/Select.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import DataList from '../components/DataList.jsx'
import SpeedModeControls from '../components/SpeedModeControls.jsx'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import SettingsSidebar, { SidebarHeaderToggle } from '../components/SettingsSidebar.jsx'
import ActionBar, { ACTION_BAR_HEIGHT } from '../components/ActionBar.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_BADGE, FS_ENTRY_WORD, FS_STAT_VALUE, FS_DISPLAY_HEADING, KANJI_FONT, WARNING } from '../data/theme.js'
import { MODULES } from '../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
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
import { briefGloss, displayFormOf } from '../utils/dictionaryEntryLookup.js'
import { useSentencesForWords } from '../hooks/useSentenceForWord.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js'
import { supabase } from '../lib/supabase.js'
import * as SimpleQueue from '../engines/simpleQueue.js'
import { WORD_DATA } from '../data/wordData.js'
import { createCard } from '../modules/vocab-srs/srs.js'
import { ensureDeck, createDeck, deleteCards } from '../modules/vocab-srs/deckUtils.js'
import DeckComboBox from '../components/DeckComboBox.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { AUDIO_SOURCE_OPTIONS, DEFAULT_AUDIO_SOURCE, getVoicevoxAudioUrl, getVoicevoxCredit, speakerIdFromAudioSource } from '../utils/voicevoxAudio.js'
import AttributionFooter from '../components/AttributionFooter.jsx'
import { renderAttributionSegments } from '../utils/attributionSegments.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'

const VOCAB_ACCENT = MODULES.find(m => m.id === 'school-vocab').accent

const MISTAKE_TIER_TONE = { none: 'success', one: 'warning', many: 'danger' }

const REVIEW_MODE_OPTIONS = [
  { value: 'kanji-front', label: 'Japanese → English' },
  { value: 'meaning-front', label: 'English → Japanese' },
]
const WORD_SOURCE_OPTIONS = WORD_SOURCES.map(source => ({ value: source.id, label: source.label }))

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
  const displayForm = word.kanji ?? displayFormOf(dictEntry) ?? word.kana
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

// The dashboard's "Start Lesson N" deep-links here as
// `#/vocab?chapter=<listKey>&start=1`. The query is read once at mount to
// seed the source/sublist selection (and optionally jump straight into the
// drill), then stripped so a reload or a return from the drill lands on the
// plain home screen.
function hashQuery() {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '')
}

function chapterFromHash() {
  const chapter = hashQuery().get('chapter')
  return chapter && WORD_DATA.some(w => w.listKey === chapter) ? chapter : null
}

function defaultSelectedSource() {
  const chapter = chapterFromHash()
  if (chapter) {
    const source = WORD_SOURCES.find(s => s.id === chapter || s.lists?.some(l => l.id === chapter))
    if (source) return source.id
  }
  return safeLocalStorageGet('vocab-selected-source') ?? WORD_SOURCES[0].id
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

function DoneScreen({
  pool, mistakeCounts, correct, troubled, onRestart, onRedoTroubled, onRedoSelected, onBack,
  decks, isMobile, onAddToSrs, onCreateDeckAndAddToSrs, onUndoAdd,
}) {
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
  const { showToast } = useToast()
  const selectionChanged = selected.size !== defaultSelectedIds.size || [...selected].some(id => !defaultSelectedIds.has(id))

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Row content is a word/reading stack, a 2-line-clamped gloss and a
  // mistake badge — three columns, the first two needing their own render.
  const columns = useMemo(() => [
    {
      key: 'word', width: 100,
      render: row => {
        const dictEntry = row.word.jmdictId ? dictEntries[row.word.jmdictId] : null
        const { displayForm, reading } = resolveWordDisplay(row.word, dictEntry)
        return (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', overflow: 'hidden' }}>
            <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayForm}
            </span>
            {reading && (
              <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reading}
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'gloss', tone: 'muted', wrap: true,
      render: row => {
        const dictEntry = row.word.jmdictId ? dictEntries[row.word.jmdictId] : null
        return (
          <span style={{ lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {row.word.english ?? briefGloss(dictEntry)}
          </span>
        )
      },
    },
    {
      key: 'mistakes', width: 36, align: 'right',
      render: row => row.mistakes > 0 ? <Badge variant="text" tone={MISTAKE_TIER_TONE[mistakeTier(row.mistakes)]}>{row.mistakes}×</Badge> : null,
    },
  ], [dictEntries])

  function showAddedToast(result) {
    if (!result) return
    if (result.count === 0) {
      showToast({ message: `Already in "${result.deckName}".` })
      return
    }
    showToast({
      message: `Added ${result.count} word${result.count === 1 ? '' : 's'} to "${result.deckName}".`,
      actionLabel: 'Undo',
      onAction: () => onUndoAdd(result.cardIds),
    })
  }

  function handleAdd(deckId) {
    const words = rows.filter(r => selected.has(r.id)).map(r => r.word)
    if (words.length === 0) return
    showAddedToast(onAddToSrs(words, deckId))
  }

  function handleCreateAndAdd(name) {
    const words = rows.filter(r => selected.has(r.id)).map(r => r.word)
    if (words.length === 0) return
    showAddedToast(onCreateDeckAndAddToSrs(words, name))
  }

  return (
    <div style={{ textAlign: 'center', fontFamily: FONT, width: '100%', maxWidth: 560, padding: '48px 24px 48px' }}>
      <div style={{ color: '#fff', fontSize: FS_DISPLAY_HEADING, letterSpacing: '0.05em', marginBottom: 16 }}>Session complete</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: FS_CAPTION, marginBottom: 4 }}>CORRECT</div>
          <div style={{ color: '#fff', fontSize: FS_STAT_VALUE }}>{correct}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: FS_STAT_VALUE, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: troubled > 0 ? WARNING : 'rgba(255,255,255,0.4)', fontSize: FS_CAPTION, marginBottom: 4 }}>TROUBLED</div>
          <div style={{ color: troubled > 0 ? WARNING : 'rgba(255,255,255,0.4)', fontSize: FS_STAT_VALUE }}>{troubled}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {(troubled > 0 || selectionChanged) && (
          <Button
            variant="warning-outline"
            size="lg"
            onClick={() => {
              if (selectionChanged) onRedoSelected(pool.filter(p => selected.has(p.id)))
              else onRedoTroubled()
            }}
            disabled={selectionChanged && selected.size === 0}
          >
            {selectionChanged ? `Redo Selected (${selected.size})` : `Redo Troubled (${troubled})`}
          </Button>
        )}
        <Button variant="neutral" size="lg" onClick={onRestart}>Restart</Button>
        <Button variant="neutral" size="lg" onClick={onBack}>End review</Button>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 36, textAlign: 'left' }}>
          <SectionHeader
            title="Review words"
            action={(
              <DeckComboBox
                decks={decks}
                isMobile={isMobile}
                disabled={selected.size === 0}
                buttonLabel={`Add ${selected.size} to SRS`}
                onAdd={handleAdd}
                onCreateAndAdd={handleCreateAndAdd}
              />
            )}
          />
          <DataList
            columns={columns}
            rows={rows}
            selection={{ selected, onToggle: toggleRow, bulkHeader: { selectFirst: true } }}
            maxWidth="100%"
          />
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
  const ACCENT = useAccent()
  const [expandedId, setExpandedId] = useState(null)
  const [expandedKanji, setExpandedKanji] = useState([])
  const kanjiCache = useRef({})
  const expandedSet = useMemo(() => new Set(expandedId ? [expandedId] : []), [expandedId])

  async function handleToggleRow(word) {
    const next = expandedId === word.id ? null : word.id
    setExpandedId(next)
    setExpandedKanji([])
    if (!next) return

    const displayForm = word.kanji ?? displayFormOf(dictEntries[word.jmdictId]) ?? word.kana
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

  function renderWordRow(word) {
    const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
    const { displayForm, reading } = resolveWordDisplay(word, dictEntry)
    const posLabel = shortPos(Array.isArray(dictEntry?.pos) ? dictEntry.pos[0] : null)
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
          <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{displayForm}</span>
          {reading && <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{reading}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {posLabel && <Badge variant="fill" tone="neutral">{posLabel}</Badge>}
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {dictEntry?.gloss_en?.split('; ').slice(0, 2).join('; ') ?? word.english}
          </span>
        </div>
      </div>
    )
  }

  function renderWordDetail(word) {
    const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
    const tanakaSentence = word.jmdictId ? tanakaSentences[word.jmdictId] : null
    const useTanakaSentence = sentenceSource === 'tanaka' ? !!tanakaSentence : (!word.sentence && !!tanakaSentence)
    const sentenceText = useTanakaSentence ? tanakaSentence.japanese : word.sentence
    const { displayForm } = resolveWordDisplay(word, dictEntry)
    const kanjiChars = (displayForm ?? '').split('').filter(ch => /\p{Script=Han}/u.test(ch))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kanjiChars.length > 0 && (
          expandedKanji.length > 0 ? (
            expandedKanji.map(k => (
              // Inner surface inside an already-raised list — lighter than Card
              // on purpose so it reads as nested, not as a second card.
              <div key={k.literal} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: '2rem', color: TEXT, minWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>{k.literal}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {k.on_readings?.length > 0 && <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 2 }}>{k.on_readings.join('　')}</div>}
                  {k.kun_readings?.length > 0 && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 4 }}>{k.kun_readings.join('　')}</div>}
                  <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{(k.meanings ?? '').split('; ').slice(0, 4).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {k.jlpt != null && <Badge tone="accent">N{k.jlpt}</Badge>}
                  {k.stroke_count != null && <Badge variant="text" tone="neutral">{k.stroke_count} strokes</Badge>}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, padding: '6px 0' }}>Loading…</div>
          )
        )}
        {sentenceText && (
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontStyle: 'italic', padding: '2px 0' }}>{sentenceText}</div>
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
    )
  }

  const columns = [{ key: 'word', render: renderWordRow, wrap: true }]

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '32px 24px 48px' }}>
      {grouped.map(group => (
        <div key={group.listId} style={{ marginBottom: 40 }}>
          <SectionHeader title={group.label} />
          <DataList
            columns={columns}
            rows={group.words}
            rowKey={w => w.id}
            expand={{ expanded: expandedSet, onToggle: id => handleToggleRow(group.words.find(w => w.id === id)), render: renderWordDetail }}
            padding="12px 16px"
            maxWidth="100%"
          />
        </div>
      ))}
    </div>
  )
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

function HomeScreen({ selectedSourceId, onSelectSource, availableSubLists, selectedSubLists, onToggleSubList, wordCountByList, reviewWordCount, includeReview, onToggleIncludeReview, sentenceVocabWordCount, includeSentenceVocab, onToggleIncludeSentenceVocab, vocabProgress, reviewMode, onChangeReviewMode, onStart, onGlance }) {
  const canStart = selectedSubLists.length > 0

  return (
    <div style={{
      width: '100%',
      maxWidth: 680,
      margin: '0 auto',
      padding: `32px 24px ${ACTION_BAR_HEIGHT + 24}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>

      {/* Direction */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>
          DRILL MODE
        </label>
        <ChipSelector mode="single" size="md" grow options={REVIEW_MODE_OPTIONS} value={reviewMode} onChange={onChangeReviewMode} />
      </div>

      {/* Source selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>
          WORD LIST
        </label>
      <Select value={selectedSourceId} onChange={onSelectSource} size="md" options={WORD_SOURCE_OPTIONS} />
      {reviewWordCount > 0 && (
        <div style={{ marginTop: 4 }}>
          <Checkbox checked={includeReview} onChange={onToggleIncludeReview} label={`Include review words (${reviewWordCount})`} />
        </div>
      )}
      {sentenceVocabWordCount > 0 && (
        <div style={{ marginTop: 4 }}>
          <Checkbox checked={includeSentenceVocab} onChange={onToggleIncludeSentenceVocab} label={`Include sentence review words (${sentenceVocabWordCount})`} />
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

      <ActionBar maxWidth={680}>
        <Button variant="neutral" size="xl" disabled>Send to SRS</Button>
        <Button variant="neutral" size="xl" onClick={onGlance} disabled={!canStart}>Preview</Button>
        <Button size="xl" onClick={onStart} disabled={!canStart}>
          Start review
          {selectedSubLists.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: FS_CAPTION, opacity: 0.8 }}>
              ({selectedSubLists.reduce((sum, id) => sum + (wordCountByList[id] ?? 0), 0)} words)
            </span>
          )}
        </Button>
      </ActionBar>
    </div>
  )
}

// A two-line selectable tile (label + count/recency). Kept bespoke: it's
// a Chip with a second line and a grid layout, which Chip doesn't express —
// see the review log. Hover is the .sublist-tile class in global.css.
function SubListTile({ label, wordCount, progress, selected, onClick }) {
  const timeAgo = relativeTime(progress?.lastReviewed)
  return (
    <button
      onClick={onClick}
      className={selected ? 'sublist-tile sublist-tile--selected' : 'sublist-tile'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        width: '100%',
        minHeight: 54,
        padding: '10px 12px',
        border: `1px solid ${selected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: TRACKING,
      }}
    >
      <span style={{ fontSize: FS_BASE, color: selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}>
        {label}
      </span>
      <span style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {wordCount} words
        {!progress ? (
          <Badge tone="accent" dimmed>New</Badge>
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
  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <VocabPageScreens />
    </ModuleThemeProvider>
  )
}

function VocabPageScreens() {
  const ACCENT = useAccent()
  const { user } = useAuth()
  const { data: vocabProgress, save: saveVocabProgress } = useProgress('vocab-flashcard')
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')

  const [showOptions,       setShowOptions]       = useState(() => window.innerWidth > 768)
  const [selectedSourceId,  setSelectedSourceId]  = useState(defaultSelectedSource)
  const [selectedSubLists,  setSelectedSubLists]  = useState(() => {
    const chapter = chapterFromHash()
    return chapter ? [chapter] : []
  })
  const [reviewMode,       setReviewMode]       = useState(() => safeLocalStorageGet('vocab-review-mode') ?? 'kanji-front')
  const [isDrilling,       setIsDrilling]       = useState(() => !!chapterFromHash() && hashQuery().get('start') === '1')
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
  const [includeSentenceVocab, setIncludeSentenceVocab] = useState(() => {
    const s = safeLocalStorageGet('vocab-include-sentence-vocab'); return s === null ? false : s === 'true'
  })
  const [pulseColor,       setPulseColor]       = useState(null)
  const [headerHeight,     setHeaderHeight]     = useState(72)
  const headerRef   = useRef(null)
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
  useEffect(() => { safeLocalStorageSet('vocab-include-sentence-vocab', includeSentenceVocab) }, [includeSentenceVocab])

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

  const reviewWordCount = useMemo(() =>
    WORD_DATA.filter(w => selectedSubLists.includes(w.listKey) && w.isReview).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(',')]
  )

  const sentenceVocabWordCount = useMemo(() =>
    WORD_DATA.filter(w => selectedSubLists.includes(w.listKey) && w.isSentenceVocab).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(',')]
  )

  const wordCountByList = useMemo(() => {
    const map = {}
    for (const w of WORD_DATA) {
      if (!includeReview && w.isReview) continue
      if (!includeSentenceVocab && w.isSentenceVocab) continue
      map[w.listKey] = (map[w.listKey] ?? 0) + 1
    }
    return map
  }, [includeReview, includeSentenceVocab])

  const glanceWords = useMemo(() =>
    WORD_DATA.filter(w => selectedSubLists.includes(w.listKey) && (includeReview || !w.isReview) && (includeSentenceVocab || !w.isSentenceVocab)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(','), includeReview, includeSentenceVocab]
  )

  const pool = useMemo(() =>
    glanceWords.map(w => ({ id: w.id, word: w })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubLists.join(','), includeReview, includeSentenceVocab]
  )

  const drill = useDrill(pool, { engine: SimpleQueue })

  // Warm the shared dictionary-entry cache for the whole selected pool as
  // soon as it's chosen — well before "Start Drill" — so ActiveDrill/
  // DoneScreen/GlanceScreen's own useDictionaryEntries calls resolve from
  // cache instead of flashing a loading state per card.
  const poolJmdictIds = useMemo(() => pool.map(p => p.word.jmdictId).filter(Boolean), [pool])
  const { entries: poolDictEntries } = useDictionaryEntries(poolJmdictIds, true)

  useEffect(() => {
    if (window.location.hash.includes('?')) window.history.replaceState(null, '', '#/vocab')
  }, [])

  // Save progress when session completes. Not gated on sign-in: useProgress
  // falls back to localStorage when logged out, and the dashboard's chapter
  // pointer needs drilled state either way.
  useEffect(() => {
    if (!isDrilling || !drill.done) return
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

  // Shared by handleAddToSrs/handleCreateDeckAndAddToSrs — builds new card
  // entries for words not already in the target deck (deduped by front form).
  function buildCardsForWords(words, targetDeckId, existingCardsObj) {
    const existingFronts = new Set(
      Object.values(existingCardsObj)
        .filter(c => c.deckId === targetDeckId)
        .map(c => c.front)
    )
    const newCards = {}
    const newCardIds = []
    words.forEach((word, i) => {
      const dictEntry = word.jmdictId ? poolDictEntries[word.jmdictId] : null
      const front = word.kanji ?? displayFormOf(dictEntry) ?? word.kana
      if (existingFronts.has(front)) return
      existingFronts.add(front)
      const cardId = `${targetDeckId}-${Date.now()}-${i}`
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
      newCards[cardId] = createCard(front, english, cardId, targetDeckId, extras)
      newCardIds.push(cardId)
    })
    return { newCards, newCardIds }
  }

  function handleAddToSrs(words, deckId) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = ensureDeck(current.decks, deckId, current.decks[deckId]?.name ?? 'Deck')
    const { newCards, newCardIds } = buildCardsForWords(words, deckId, current.cards)
    const deckName = decks[deckId]?.name ?? 'Deck'
    if (newCardIds.length > 0) {
      saveSrs({ ...current, decks, cards: { ...current.cards, ...newCards } })
    }
    return { count: newCardIds.length, cardIds: newCardIds, deckName }
  }

  function handleCreateDeckAndAddToSrs(words, name) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const { decks, deckId } = createDeck(current.decks, name)
    const { newCards, newCardIds } = buildCardsForWords(words, deckId, current.cards)
    saveSrs({ ...current, decks, cards: { ...current.cards, ...newCards } })
    return { count: newCardIds.length, cardIds: newCardIds, deckName: name }
  }

  function handleUndoAdd(cardIds) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    saveSrs({ ...current, cards: deleteCards(current.cards, cardIds) })
  }

  function handleSelectSource(sourceId) {
    if (sourceId === selectedSourceId) return
    setSelectedSourceId(sourceId)
    setSelectedSubLists([])
  }

  function renderPanelContent(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>

        <SectionHeader title="Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Checkbox checked={showStreak}        onChange={() => setShowStreak(v => !v)}        label="Show streak" />
          <Checkbox checked={showFurigana}      onChange={() => setShowFurigana(v => !v)}      label="Show furigana" />
          <Checkbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <Checkbox checked={pixelFont}         onChange={() => setPixelFont(v => !v)}         label="Use pixel font" />
          <Checkbox checked={showTranslation}   onChange={() => setShowTranslation(v => !v)}   label="Show translation" />
          <Checkbox checked={showSentence}      onChange={() => setShowSentence(v => !v)}       label="Show sentence" />
          {showSentence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
              <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Sentence source</span>
              <Select
                value={sentenceSource}
                onChange={setSentenceSource}
                options={SENTENCE_SOURCE_OPTIONS}
                label="Sentence source"
              />
            </div>
          )}
          <Checkbox checked={showKanjiMeaning}  onChange={() => setShowKanjiMeaning(v => !v)}   label="Show kanji meaning" />
          <Checkbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Text to speech</span>
                <Select
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
                  <Select
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </div>
              <Checkbox
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
              isDrilling
                ? [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training', onClick: () => setIsDrilling(false) }, { label: 'Reviewing' }]
                : isGlancing
                ? [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training', onClick: () => setIsGlancing(false) }, { label: 'Preview' }]
                : [{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training' }]
            }
            rightSlot={(
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <AuthSlot />
                {isMobile && <SidebarHeaderToggle onClick={() => setShowOptions(true)} />}
              </div>
            )}
          />
          {isDrilling && !drill.done && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                height: '100%',
                width: `${(drill.correct + drill.remaining) > 0 ? (drill.correct / (drill.correct + drill.remaining)) * 100 : 0}%`,
                background: ACCENT,
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
                  onCreateDeckAndAddToSrs={handleCreateDeckAndAddToSrs}
                  onUndoAdd={handleUndoAdd}
                  decks={srsData?.decks ?? {}}
                  isMobile={isMobile}
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
                reviewWordCount={reviewWordCount}
                includeReview={includeReview}
                onToggleIncludeReview={() => setIncludeReview(v => !v)}
                sentenceVocabWordCount={sentenceVocabWordCount}
                includeSentenceVocab={includeSentenceVocab}
                onToggleIncludeSentenceVocab={() => setIncludeSentenceVocab(v => !v)}
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
