import { useState, useEffect, useRef, useMemo } from 'react'
import FlipCard from '../../FlipCard.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_DISPLAY_HEADING, FS_STAT_VALUE, FS_CAPTION } from '../../data/theme.js'
import { Rating, State, previewIntervals } from './srs.js'
import { answerCard, undoLastAnswer, isComplete, getSessionStats, getCurrentCard, getWaitMs } from './session.js'
import { useTTS } from '../../hooks/useTTS.js'
import { useSFX } from '../../hooks/useSFX.js'
import { useGamepad } from '../../hooks/useGamepad.js'
import { useKanjiMeanings } from '../../hooks/useKanjiMeanings.js'
import { getVoicevoxAudioUrl, speakerIdFromAudioSource } from '../../utils/voicevoxAudio.js'
import { kanjiCharsOf } from '../../utils/kanjiMeaningLookup.js'
import { useDictionaryEntry } from '../../hooks/useDictionaryEntries.js'
import { briefGloss } from '../../utils/dictionaryEntryLookup.js'
import { useSentenceForWord } from '../../hooks/useSentenceForWord.js'
import AttributionFooter from '../../components/AttributionFooter.jsx'

const CARD_BG = '#E8E4DE'
const RELEARN_STEP_LABEL = '10m'
// Advance timings mirror VocabPage's verdict handler: the answered card slides/fades out
// via FlipCard.css's cardExit* keyframes, then the next card's own content mounts fresh
// (no 3D flip-back) via cardEnter — a single continuous motion instead of un-flipping the
// current card back to its own front before jump-cutting to the next one.
const EXIT_MS = 280
const CLEAR_MS = 600
const UNDO_EXIT_MS = 200
const UNDO_CLEAR_MS = 580

const AUDIO_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/audio/imported`
  : null

function getAudioUrl(filename) {
  return filename && AUDIO_BASE ? `${AUDIO_BASE}/${filename}` : null
}

function formatInterval(dueDate, now = new Date()) {
  const ms = dueDate - now
  if (ms < 60000) return '< 1m'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(ms / 3600000)
  if (hours < 24) return `${hours}h`
  const days = Math.round(ms / 86400000)
  if (days < 30) return `${days}d`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `${weeks}w`
  return `${Math.round(days / 30)}mo`
}

function formatCountdown(ms) {
  const totalSecs = Math.ceil(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function KanjiMeaningBar({ chars, meanings, jaFont }) {
  return (
    <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.14)', backgroundColor: 'rgba(0,0,0,0.035)' }}>
      {chars.map((ch, i) => (
        <div key={`${ch}-${i}`} style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '1.8cqw 1cqw', gap: 2,
          borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
        }}>
          <span style={{ fontFamily: jaFont, fontSize: '5cqw', color: '#333' }}>{ch}</span>
          <div style={{
            fontFamily: FONT, fontSize: '2.6cqw', color: '#777', textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
          }}>
            {meanings[ch]}
          </div>
        </div>
      ))}
    </div>
  )
}

function SrsCardFace({ text, kana, isBack, backText, jmdictId, sentence, sentenceEnglish, showFurigana, showTranslation, showSentence, sentenceSource, showKanjiMeaning, pixelFont }) {
  const cardFont = pixelFont ? FONT : 'system-ui, sans-serif'
  const showReading = kana && kana !== text && (isBack || showFurigana)

  const kanjiMeaningsEnabled = isBack && showKanjiMeaning
  const kanjiMeanings = useKanjiMeanings(text, kanjiMeaningsEnabled)
  const kanjiChars = kanjiMeaningsEnabled ? kanjiCharsOf(text) : []
  const meaningBarReady = kanjiChars.length > 0 && kanjiChars.every(ch => ch in kanjiMeanings)

  // Dictionary is the source of truth for the definition when this card is
  // linked (jmdictId); the card's own `back` text is only a fallback for cards
  // that don't have (or don't yet have) a dictionary match.
  const { entry: dictEntry } = useDictionaryEntry(jmdictId, true)
  const resolvedBackText = briefGloss(dictEntry) ?? backText

  // The card's own sentence wins by default ('custom'); a Tanaka Corpus
  // sentence fills the gap when there isn't one, or takes priority outright
  // when sentenceSource is 'tanaka'.
  const tanakaSentence = useSentenceForWord(jmdictId, isBack && showSentence)
  const useTanaka = sentenceSource === 'tanaka' ? !!tanakaSentence : (!sentence && !!tanakaSentence)
  const resolvedSentence = useTanaka ? tanakaSentence.japanese : sentence
  const resolvedSentenceEnglish = useTanaka ? tanakaSentence.english : sentenceEnglish

  return (
    <div style={{ backgroundColor: CARD_BG, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 20px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: cardFont,
            fontSize: isBack ? '10cqw' : '12.63cqw',
            color: '#222',
            letterSpacing: 'normal',
            lineHeight: 1.3,
            textShadow: '2px 2px 0 rgba(0,0,0,0.25)',
          }}>
            {text}
          </div>
          {showReading && (
            <div style={{
              fontFamily: cardFont,
              fontSize: '5.26cqw',
              color: '#666',
              marginTop: 4,
            }}>
              {kana}
            </div>
          )}
        </div>
        {isBack && resolvedBackText && showTranslation && (
          <div style={{
            fontFamily: cardFont,
            fontSize: '5.26cqw',
            color: '#555',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {resolvedBackText}
          </div>
        )}
        {isBack && resolvedSentence && showSentence && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: cardFont,
              fontSize: '4.2cqw',
              color: '#666',
              lineHeight: 1.5,
            }}>
              {resolvedSentence}
            </div>
            {resolvedSentenceEnglish && (
              <div style={{
                fontFamily: cardFont,
                fontSize: '3.5cqw',
                color: '#888',
                lineHeight: 1.5,
                fontStyle: 'italic',
                marginTop: 2,
              }}>
                {resolvedSentenceEnglish}
              </div>
            )}
          </div>
        )}
      </div>
      {isBack && meaningBarReady && <KanjiMeaningBar chars={kanjiChars} meanings={kanjiMeanings} jaFont={cardFont} />}
    </div>
  )
}

function AudioButton({ label, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 10px',
        fontSize: FS_BASE,
        fontFamily: 'inherit',
        letterSpacing: TRACKING,
        background: hovered ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: 'rgba(255,255,255,0.45)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 5,
        cursor: 'pointer',
        transition: 'background 130ms, color 130ms',
      }}
    >
      ▶ {label}
    </button>
  )
}

function RatingButton({ label, hint, interval, color, onClick, flex = 1, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="verdict-btn"
      style={{
        flex,
        padding: '8px 0',
        fontSize: FS_BASE,
        fontFamily: 'inherit',
        letterSpacing: TRACKING,
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>{label} {hint && <span style={{ opacity: 0.6, fontSize: FS_CAPTION }}>[{hint}]</span>}</span>
      {interval && <span style={{ fontSize: FS_CAPTION, opacity: 0.65 }}>{interval}</span>}
    </button>
  )
}

function DoneScreen({ stats, onDone }) {
  const btnBase = {
    padding: '10px 28px',
    fontSize: FS_BASE,
    fontFamily: FONT,
    letterSpacing: TRACKING,
    borderRadius: 8,
    cursor: 'pointer',
  }
  return (
    <div style={{ textAlign: 'center', fontFamily: FONT, letterSpacing: TRACKING }}>
      <div style={{ color: TEXT, fontSize: FS_DISPLAY_HEADING, marginBottom: 16 }}>Session complete</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ color: TEXT_MUTED, fontSize: FS_CAPTION, marginBottom: 4 }}>REVIEWED</div>
          <div style={{ color: TEXT, fontSize: FS_STAT_VALUE }}>{stats.goodCount}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: FS_STAT_VALUE, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: stats.againCount > 0 ? '#fbbf24' : TEXT_MUTED, fontSize: FS_CAPTION, marginBottom: 4 }}>AGAIN</div>
          <div style={{ color: stats.againCount > 0 ? '#fbbf24' : TEXT_MUTED, fontSize: FS_STAT_VALUE }}>{stats.againCount}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: FS_STAT_VALUE, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: TEXT_MUTED, fontSize: FS_CAPTION, marginBottom: 4 }}>TIME</div>
          <div style={{ color: TEXT, fontSize: FS_STAT_VALUE }}>{formatTime(stats.elapsedSeconds)}</div>
        </div>
      </div>
      {stats.againCount > 0 && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 24 }}>
          You missed {stats.againCount} {stats.againCount === 1 ? 'card' : 'cards'} — all cleared by end of session
        </div>
      )}
      <button
        onClick={onDone}
        style={{
          ...btnBase,
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        Done
      </button>
    </div>
  )
}

export default function VocabSrsDrill({
  initialCards, initialSession, onCardSave, onDone,
  showTranslation = true, showFurigana = true, showSentence = true, sentenceSource = 'custom', showKanjiMeaning = false,
  pixelFont = true, showVisualEffects = true,
  audioEnabled = true, autoplayFront = true, autoplayBack = true,
  audioSource = 'voicevox-2', sfxEnabled = true, ttsVoice = '',
  showHardEasy = true, leechThreshold = 8,
  isMobile = false, onShowOptions,
  crumbs = [{ label: 'Japanese Study', href: '#/' }],
}) {
  const [session, setSession] = useState(initialSession)
  const [localCards, setLocalCards] = useState(initialCards)
  const [flipped, setFlipped] = useState(false)
  const [optionsHovered, setOptionsHovered] = useState(false)
  const [leechNotice, setLeechNotice] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [exitDir, setExitDir] = useState(null)
  const [undoEntering, setUndoEntering] = useState(false)

  // Force re-render every second so waitUntil countdowns and card availability update.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const tts = useTTS(ttsVoice)
  const sfx = useSFX()

  // Priority: real recorded audio (Core 2000) > generated Voicevox audio > browser TTS.
  function resolveAudioUrl(card) {
    if (!card) return { word: null, sentence: null }
    if (card.wordAudio) return { word: getAudioUrl(card.wordAudio), sentence: getAudioUrl(card.sentenceAudio) }
    const speakerId = speakerIdFromAudioSource(audioSource)
    if (speakerId && card.voicevoxVoices?.includes(speakerId)) {
      return { word: getVoicevoxAudioUrl(speakerId, card.voicevoxId ?? card.id), sentence: null }
    }
    return { word: null, sentence: null }
  }

  const seenRef = useRef(new Set())
  const flippedRef = useRef(false)
  flippedRef.current = flipped
  const transitioningRef = useRef(false)
  useEffect(() => { transitioningRef.current = transitioning }, [transitioning])

  const audioCurrentRef = useRef(null)
  const audioPreloadRef = useRef({ audio: null, filename: null })

  // These two take resolved URLs directly (not filenames) so they work for both
  // the imported-audio bucket (via getAudioUrl) and the voicevox bucket (via getVoicevoxAudioUrl).
  const playAudioRef = useRef()
  playAudioRef.current = (url) => {
    if (!url) return
    if (audioCurrentRef.current) {
      audioCurrentRef.current.onended = null
      audioCurrentRef.current.pause()
    }
    if (audioPreloadRef.current.filename === url && audioPreloadRef.current.audio) {
      audioCurrentRef.current = audioPreloadRef.current.audio
      audioPreloadRef.current = { audio: null, filename: null }
    } else {
      audioCurrentRef.current = new Audio(url)
    }
    audioCurrentRef.current.play().catch(() => {})
  }

  // Plays wordUrl, then sentenceUrl when word finishes.
  const playSequenceRef = useRef()
  playSequenceRef.current = (wordUrl, sentenceUrl) => {
    if (!wordUrl) return
    if (audioCurrentRef.current) {
      audioCurrentRef.current.onended = null
      audioCurrentRef.current.pause()
    }
    let wordAudio
    if (audioPreloadRef.current.filename === wordUrl && audioPreloadRef.current.audio) {
      wordAudio = audioPreloadRef.current.audio
      audioPreloadRef.current = { audio: null, filename: null }
    } else {
      wordAudio = new Audio(wordUrl)
    }
    audioCurrentRef.current = wordAudio
    if (sentenceUrl) {
      wordAudio.onended = () => {
        const sentAudio = new Audio(sentenceUrl)
        audioCurrentRef.current = sentAudio
        sentAudio.play().catch(() => {})
      }
    }
    wordAudio.play().catch(() => {})
  }

  const stopAudioRef = useRef()
  stopAudioRef.current = () => {
    if (audioCurrentRef.current) {
      audioCurrentRef.current.onended = null
      audioCurrentRef.current.pause()
      audioCurrentRef.current = null
    }
  }

  const sessionRef = useRef(session)
  sessionRef.current = session
  const localCardsRef = useRef(localCards)
  localCardsRef.current = localCards

  const handleAnswerRef = useRef()
  handleAnswerRef.current = (rating) => {
    if (transitioningRef.current) return
    const currentCard = getCurrentCard(sessionRef.current)
    if (!currentCard) return
    if (sfxEnabled) sfx.play(rating === Rating.Again ? 'flip_card_wrong' : 'flip_card_correct')
    tts.cancel()
    stopAudioRef.current()
    seenRef.current.add(currentCard.id)
    const { session: newSession, updatedCard, isLeech } = answerCard(
      sessionRef.current, currentCard, rating, { leechThreshold }
    )
    setTransitioning(true)
    setExitDir(rating === Rating.Again ? 'down' : 'up')
    const exitDelay = showVisualEffects ? EXIT_MS : 0
    const clearDelay = showVisualEffects ? CLEAR_MS : 0
    setTimeout(() => {
      const updatedCards = localCardsRef.current.map(c => c.id === updatedCard.id ? updatedCard : c)
      setLocalCards(updatedCards)
      setSession(newSession)
      setFlipped(false)
      onCardSave(updatedCards)
      if (isLeech) {
        setLeechNotice(currentCard.front)
        setTimeout(() => setLeechNotice(null), 4000)
      }
      setExitDir(null)
    }, exitDelay)
    setTimeout(() => setTransitioning(false), clearDelay)
  }

  const handleFlipRef = useRef()
  handleFlipRef.current = () => {
    if (transitioningRef.current) return
    if (sfxEnabled) sfx.play('flip_card')
    const currentCard = getCurrentCard(sessionRef.current)
    if (audioEnabled && autoplayBack && currentCard) {
      const urls = resolveAudioUrl(currentCard)
      if (urls.word) {
        playSequenceRef.current(urls.word, urls.sentence)
      } else if (audioSource === 'browser') {
        tts.speak(currentCard.front ?? '')
      }
    }
    setFlipped(true)
  }

  const handleUndoRef = useRef()
  handleUndoRef.current = () => {
    if (transitioningRef.current) return
    const { session: prevSession, revertedCard } = undoLastAnswer(sessionRef.current)
    if (prevSession === sessionRef.current) return
    stopAudioRef.current()
    setTransitioning(true)
    setExitDir('undo')
    const exitDelay = showVisualEffects ? UNDO_EXIT_MS : 0
    const clearDelay = showVisualEffects ? UNDO_CLEAR_MS : 0
    setTimeout(() => {
      if (revertedCard) {
        seenRef.current.delete(revertedCard.id)
        const revertedCards = localCardsRef.current.map(c => c.id === revertedCard.id ? revertedCard : c)
        setLocalCards(revertedCards)
        onCardSave(revertedCards)
      }
      setSession(prevSession)
      setFlipped(false)
      setExitDir(null)
      setUndoEntering(true)
    }, exitDelay)
    setTimeout(() => { setTransitioning(false); setUndoEntering(false) }, clearDelay)
  }

  const handleReplayRef = useRef()
  handleReplayRef.current = () => {
    const currentCard = getCurrentCard(sessionRef.current)
    if (!currentCard || !audioEnabled) return
    const urls = resolveAudioUrl(currentCard)
    if (urls.word) {
      if (flippedRef.current) {
        playSequenceRef.current(urls.word, urls.sentence)
      } else {
        playAudioRef.current(urls.word)
      }
    } else if (audioSource === 'browser') {
      tts.speak(currentCard.front ?? '')
    }
  }

  useGamepad({
    onA: () => {
      if (!flippedRef.current) {
        handleFlipRef.current()
      } else {
        handleAnswerRef.current(Rating.Good)
      }
    },
    onB: () => {
      if (flippedRef.current) handleAnswerRef.current(Rating.Again)
    },
    onX: () => {
      if (flippedRef.current && showHardEasy) handleAnswerRef.current(Rating.Easy)
    },
    onY: () => {
      if (flippedRef.current && showHardEasy) handleAnswerRef.current(Rating.Hard)
    },
    onLeftShoulder: () => handleUndoRef.current(),
    onRightShoulder: () => handleReplayRef.current(),
  })

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!flippedRef.current) handleFlipRef.current()
        return
      }
      if (e.code === 'KeyZ') { handleUndoRef.current(); return }
      if (!flippedRef.current) return
      if (e.code === 'Digit1' || e.code === 'KeyJ') handleAnswerRef.current(Rating.Again)
      if (showHardEasy) {
        if (e.code === 'Digit2' || e.code === 'KeyH') handleAnswerRef.current(Rating.Hard)
        if (e.code === 'Digit3' || e.code === 'KeyK') handleAnswerRef.current(Rating.Good)
        if (e.code === 'Digit4' || e.code === 'KeyE') handleAnswerRef.current(Rating.Easy)
      } else {
        if (e.code === 'Digit2' || e.code === 'KeyK') handleAnswerRef.current(Rating.Good)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHardEasy])

  // Must be before the isComplete early return — hooks cannot be called conditionally.
  // previewIntervals uses enable_fuzz so re-calling every tick re-rolls the fuzz; memoize per card ID.
  const currentCardForMemo = getCurrentCard(session)
  const intervals = useMemo(
    () => currentCardForMemo ? previewIntervals(currentCardForMemo) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCardForMemo?.id]
  )

  // Preload the current card's word audio as soon as the card appears.
  useEffect(() => {
    const url = resolveAudioUrl(currentCardForMemo).word
    if (!url || audioPreloadRef.current.filename === url) return
    const audio = new Audio(url)
    audio.preload = 'auto'
    audioPreloadRef.current = { audio, filename: url }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCardForMemo?.id, audioSource])

  // Auto-play word audio on the front when a new card appears.
  useEffect(() => {
    if (!audioEnabled || !autoplayFront) return
    const url = resolveAudioUrl(currentCardForMemo).word
    if (!url) return
    stopAudioRef.current()
    const t = setTimeout(() => {
      if (!flippedRef.current) playAudioRef.current(url)
    }, 50)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCardForMemo?.id, audioSource])

  const drillCrumbs = [...crumbs, { label: 'Review' }]

  // Definitions/kanji meanings and Tanaka sentences shown on the card itself are
  // real reproduced JMdict/KANJIDIC2/Tanaka Corpus content, not just an internal
  // link — this screen needs its own credit rather than relying on one shown
  // back on the deck-management screen. Voicevox is added only when it's the
  // active audio source, mirroring the contextual credit under the TTS picker.
  const activeVoicevoxSpeakerId = audioEnabled ? speakerIdFromAudioSource(audioSource) : null
  const footerSources = [
    'dictionary',
    'tanaka-corpus',
    ...(activeVoicevoxSpeakerId ? ['voicevox'] : []),
  ]

  if (isComplete(session)) {
    const stats = getSessionStats(session)
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#1E1E1E',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        color: TEXT,
      }}>
        <PageHeader
          crumbs={drillCrumbs}
          rightSlot={isMobile && onShowOptions && (
            <button
              onClick={onShowOptions}
              onMouseEnter={() => setOptionsHovered(true)}
              onMouseLeave={() => setOptionsHovered(false)}
              style={{
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
          )}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DoneScreen stats={stats} onDone={() => onDone(localCards, stats.goodCount)} />
        </div>
        <AttributionFooter sources={footerSources} />
      </div>
    )
  }

  const currentCard = getCurrentCard(session)
  const currentAudioUrls = resolveAudioUrl(currentCard)
  const stats = getSessionStats(session)
  const progressPct = stats.total > 0 ? (stats.goodCount / stats.total) * 100 : 0
  const isWaiting = !currentCard && stats.remaining > 0
  const waitMs = isWaiting ? getWaitMs(session) : 0

  const againInterval = currentCard && currentCard.state !== State.New ? RELEARN_STEP_LABEL : null

  const rightSlot = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>
        {stats.goodCount} / {stats.total}
        {stats.waitingCount > 0 && <span style={{ marginLeft: 6, color: '#fbbf24' }}>{stats.waitingCount} waiting</span>}
      </span>
      {isMobile && onShowOptions && (
        <button
          onClick={onShowOptions}
          onMouseEnter={() => setOptionsHovered(true)}
          onMouseLeave={() => setOptionsHovered(false)}
          style={{
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
      )}
    </div>
  )

  const isRequeue = currentCard && seenRef.current.has(currentCard.id)

  const front = currentCard
    ? <SrsCardFace text={currentCard.front} kana={currentCard.kana} isBack={false} showFurigana={showFurigana} backText={currentCard.back} jmdictId={currentCard.jmdictId} sentence={currentCard.sentence} sentenceEnglish={currentCard.sentenceEnglish} showTranslation={showTranslation} showSentence={showSentence} sentenceSource={sentenceSource} showKanjiMeaning={showKanjiMeaning} pixelFont={pixelFont} />
    : null
  const back = currentCard
    ? <SrsCardFace text={currentCard.front} kana={currentCard.kana} isBack={true} showFurigana={showFurigana} backText={currentCard.back} jmdictId={currentCard.jmdictId} sentence={currentCard.sentence} sentenceEnglish={currentCard.sentenceEnglish} showTranslation={showTranslation} showSentence={showSentence} sentenceSource={sentenceSource} showKanjiMeaning={showKanjiMeaning} pixelFont={pixelFont} />
    : null

  let cardClass = ''
  if (showVisualEffects) {
    if (exitDir === 'up') cardClass = 'card-exit-up'
    else if (exitDir === 'down') cardClass = 'card-exit-down'
    else if (exitDir === 'undo') cardClass = 'card-exit-undo'
    else if (undoEntering) cardClass = 'card-entering-undo'
    else if (transitioning) cardClass = 'card-entering'
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#1E1E1E',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      color: TEXT,
    }}>
      <PageHeader crumbs={drillCrumbs} rightSlot={rightSlot} />

      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: '#3ABDA4',
          transition: 'width 300ms ease',
        }} />
      </div>

      {leechNotice && (
        <div style={{
          background: 'rgba(251,191,36,0.15)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 6,
          margin: '8px 16px 0',
          padding: '8px 12px',
          fontSize: FS_BASE,
          color: '#fbbf24',
          flexShrink: 0,
        }}>
          Leech — &quot;{leechNotice}&quot; suspended after too many failed reviews
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '16px',
        overflow: 'hidden',
      }}>

        {isWaiting ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 8 }}>Relearning</div>
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 4 }}>
              Next card in {formatCountdown(waitMs)}
            </div>
            <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.2)' }}>
              {stats.waitingCount} card{stats.waitingCount !== 1 ? 's' : ''} waiting
            </div>
          </div>
        ) : (
          <>
            <div key={currentCard.id} className={cardClass} style={{ position: 'relative' }}>
              <div style={{
                width: 'min(380px, calc(100vw - 32px), calc(var(--card-max-h, 9999px) * 380 / 280))',
                aspectRatio: '380 / 280',
                containerType: 'size',
              }}>
                <FlipCard
                  front={front}
                  back={back}
                  width="100%"
                  height="100%"
                  flipped={flipped}
                  onFlip={(next) => {
                    if (transitioningRef.current) return
                    setFlipped(next)
                    if (next) {
                      if (sfxEnabled) sfx.play('flip_card')
                      if (audioEnabled && autoplayBack && currentCard) {
                        const urls = resolveAudioUrl(currentCard)
                        if (urls.word) {
                          playSequenceRef.current(urls.word, urls.sentence)
                        } else if (audioSource === 'browser') {
                          tts.speak(currentCard.front)
                        }
                      }
                    }
                  }}
                  animate={showVisualEffects}
                />
              </div>
              {isRequeue && (
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fbbf24',
                }} />
              )}
            </div>

            {audioEnabled && currentCard && currentAudioUrls.word && flipped && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <AudioButton label="Word" onClick={() => playAudioRef.current(currentAudioUrls.word)} />
                {currentAudioUrls.sentence && (
                  <AudioButton label="Sentence" onClick={() => playAudioRef.current(currentAudioUrls.sentence)} />
                )}
              </div>
            )}

            {!flipped ? (
              <div style={{
                width: 'min(380px, calc(100vw - 32px))',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.25)',
                fontSize: FS_BASE,
                padding: '10px 0',
              }}>
                Space or tap to flip
              </div>
            ) : (
              <div style={{ width: 'min(380px, calc(100vw - 32px))', display: 'flex', gap: 8 }}>
                <RatingButton
                  label="Again"
                  hint="1"
                  interval={againInterval ?? (intervals ? formatInterval(intervals[Rating.Again]) : null)}
                  color="rgba(192,57,43,0.75)"
                  onClick={() => handleAnswerRef.current(Rating.Again)}
                  disabled={transitioning}
                />
                {showHardEasy && (
                  <RatingButton
                    label="Hard"
                    hint="2"
                    interval={intervals ? formatInterval(intervals[Rating.Hard]) : null}
                    color="rgba(180,120,40,0.75)"
                    onClick={() => handleAnswerRef.current(Rating.Hard)}
                    disabled={transitioning}
                  />
                )}
                <RatingButton
                  label="Good"
                  hint={showHardEasy ? '3' : '2'}
                  interval={intervals ? formatInterval(intervals[Rating.Good]) : null}
                  color="rgba(39,174,96,0.75)"
                  onClick={() => handleAnswerRef.current(Rating.Good)}
                  disabled={transitioning}
                />
                {showHardEasy && (
                  <RatingButton
                    label="Easy"
                    hint="4"
                    interval={intervals ? formatInterval(intervals[Rating.Easy]) : null}
                    color="rgba(41,128,185,0.75)"
                    onClick={() => handleAnswerRef.current(Rating.Easy)}
                    disabled={transitioning}
                  />
                )}
              </div>
            )}
            {stats.canUndo && (
              <button
                onClick={() => handleUndoRef.current()}
                disabled={transitioning}
                style={{
                  padding: '6px 16px',
                  fontSize: FS_BASE,
                  fontFamily: 'inherit',
                  letterSpacing: TRACKING,
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  cursor: transitioning ? 'default' : 'pointer',
                  opacity: transitioning ? 0.5 : 1,
                }}
              >
                Undo [Z]
              </button>
            )}
          </>
        )}

        <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.2)' }}>
          {stats.remaining} remaining
        </div>

      </div>
      <AttributionFooter sources={footerSources} />
    </div>
  )
}
