import { useState, useMemo, useEffect, useRef } from 'react'
import VocabCard from '../components/VocabCard.jsx'
import DrillHUD from '../components/DrillHUD.jsx'
import SelectButton from '../components/SelectButton.jsx'
import DrawerSectionHeader from '../components/DrawerSectionHeader.jsx'
import DrawerCheckbox from '../components/DrawerCheckbox.jsx'
import DrawerSelect from '../components/DrawerSelect.jsx'
import SpeedModeControls from '../components/SpeedModeControls.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { FONT, TRACKING } from '../data/theme.js'
import { WORD_SOURCES } from '../data/wordLists.js'
import { useDrill } from '../hooks/useDrill.js'
import { useTTS, useJaVoices } from '../hooks/useTTS.js'
import { useSFX } from '../hooks/useSFX.js'
import { useGamepad } from '../hooks/useGamepad.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js'
import * as SimpleQueue from '../engines/simpleQueue.js'
import NSM_N3 from '../data/words/nsm_n3_vocab.json'
import NSM_N3_I4_RAW from '../data/words/nsm_n3_i4_vocab.json'

const NSM_N3_I4 = NSM_N3_I4_RAW.map(w => ({
  ...w,
  id: `i4-${w.id}`,
  listKey: w.listKey.replace('nsm-n3-', 'nsm-n3-i4-'),
}))

const WORD_DATA = [...NSM_N3, ...NSM_N3_I4]

const PANEL_W = 420
const DEFAULT_LIST_KEYS = WORD_SOURCES.filter(s => !s.lists).map(s => s.id)
const CHEVRON_W = 28
const PANEL_CONTENT_W = PANEL_W - CHEVRON_W

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

// ── ActiveDrill ───────────────────────────────────────────────────────────────

function ActiveDrill({ drill, ttsEnabled, sfxEnabled, ttsVoice, showStreak, showFurigana, showTranslation, showSentence, pixelFont, showVisualEffects, onPulse, isShort }) {
  const [flippedCardId, setFlippedCardId] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [exitDir, setExitDir] = useState(null)
  const [undoEntering, setUndoEntering] = useState(false)
  const { currentCard, streak, bestStreak, correct, troubled, remaining, canUndo, onUndo } = drill
  const isFlipped = flippedCardId === currentCard.id
  const tts = useTTS(ttsVoice)

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
    if (isFlipped && ttsEnabled) {
      tts.speak(currentCard.word.kana)
    } else {
      tts.cancel()
    }
    return () => tts.cancel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, currentCard.id, ttsEnabled])

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
    onRightShoulder: () => { if (ttsEnabled) tts.speak(currentCard.word.kana) },
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
            showFurigana={showFurigana}
            showTranslation={showTranslation}
            showSentence={showSentence}
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

function DoneScreen({ correct, troubled, onRestart, onRedoTroubled }) {
  const btnBase = {
    padding: '10px 28px',
    fontSize: 14,
    fontFamily: 'inherit',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  }
  return (
    <div style={{ textAlign: 'center', fontFamily: FONT }}>
      <div style={{ color: '#fff', fontSize: 28, letterSpacing: '0.05em', marginBottom: 16 }}>Session complete</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>CORRECT</div>
          <div style={{ color: '#fff', fontSize: 24 }}>{correct}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 24, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: troubled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>TROUBLED</div>
          <div style={{ color: troubled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontSize: 24 }}>{troubled}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {troubled > 0 && (
          <button
            onClick={onRedoTroubled}
            style={{ ...btnBase, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}
          >
            Redo Troubled ({troubled})
          </button>
        )}
        <button
          onClick={onRestart}
          style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Restart
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabPage() {
  const [showOptions,      setShowOptions]      = useState(() => window.innerWidth > 768)
  const [selectedLists,    setSelectedLists]    = useState(() => DEFAULT_LIST_KEYS)
  const [expandedSourceId, setExpandedSourceId] = useState(null)
  const [audioEnabled,     setAudioEnabled]     = useState(() => {
    const s = safeLocalStorageGet('vocab-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsEnabled,       setTtsEnabled]       = useState(() => {
    const s = safeLocalStorageGet('vocab-tts-enabled'); return s === null ? false : s === 'true'
  })
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
  const [pulseColor,       setPulseColor]       = useState(null)
  const [headerHeight,     setHeaderHeight]     = useState(72)
  const headerRef   = useRef(null)
  const [audioHovered,   setAudioHovered]   = useState(false)
  const [optionsHovered, setOptionsHovered] = useState(false)
  const [chevronHovered, setChevronHovered] = useState(false)
  const isMobile = useIsMobile()
  const isShort  = useIsShort()
  const jaVoices = useJaVoices()

  useEffect(() => { safeLocalStorageSet('vocab-audio-enabled',  audioEnabled) },     [audioEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-tts-enabled',    ttsEnabled) },       [ttsEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-sfx-enabled',    sfxEnabled) },       [sfxEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-tts-voice',      ttsVoice) },         [ttsVoice])
  useEffect(() => { safeLocalStorageSet('vocab-show-streak',    showStreak) },       [showStreak])
  useEffect(() => { safeLocalStorageSet('vocab-show-furigana',  showFurigana) },     [showFurigana])
  useEffect(() => { safeLocalStorageSet('vocab-visual-effects', showVisualEffects) },[showVisualEffects])
  useEffect(() => { safeLocalStorageSet('vocab-pixel-font',     pixelFont) },        [pixelFont])
  useEffect(() => { safeLocalStorageSet('vocab-show-translation', showTranslation) },[showTranslation])
  useEffect(() => { safeLocalStorageSet('vocab-show-sentence',    showSentence) },   [showSentence])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pool = useMemo(() =>
    WORD_DATA
      .filter(w => selectedLists.includes(w.listKey))
      .map(w => ({ id: w.id, word: w })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLists.join(',')]
  )

  const drill = useDrill(pool, { engine: SimpleQueue })
  const hasSelection = selectedLists.length > 0

  const hairline = { height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }

  function handleSidebarFocus(e) {
    const container = e.currentTarget
    const target = e.target
    const cRect = container.getBoundingClientRect()
    const tRect = target.getBoundingClientRect()
    if (tRect.top < cRect.top + 8) container.scrollTop += tRect.top - cRect.top - 8
    else if (tRect.bottom > cRect.bottom - 8) container.scrollTop += tRect.bottom - cRect.bottom + 8
  }

  function renderPanelContent(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>

        {/* ── Word Lists ── */}
        <DrawerSectionHeader
          title="Word Lists"
          hasSelections={selectedLists.length > 0}
          onClearAll={() => setSelectedLists([])}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WORD_SOURCES.map(source => {
            if (!source.lists) {
              return (
                <SelectButton
                  key={source.id}
                  selected={selectedLists.includes(source.id)}
                  centered minHeight={44} fontSize={13}
                  onClick={() => setSelectedLists(prev => toggle(prev, source.id))}
                >
                  {source.label}
                </SelectButton>
              )
            }
            const isExpanded = expandedSourceId === source.id
            const sourceKeys = source.lists.map(l => l.id)
            const selectedCount = sourceKeys.filter(k => selectedLists.includes(k)).length
            return (
              <div key={source.id}>
                <button
                  onClick={() => setExpandedSourceId(prev => prev === source.id ? null : source.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: isExpanded ? '6px 6px 0 0' : 6,
                    color: 'rgba(255,255,255,0.8)',
                    fontFamily: 'inherit', letterSpacing: 'inherit',
                    fontSize: 13, cursor: 'pointer',
                    transition: 'background 130ms',
                  }}
                >
                  <span>{source.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedCount > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                        {selectedCount}/{sourceKeys.length}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.4)',
                      display: 'inline-block',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms',
                    }}>▾</span>
                  </span>
                </button>
                {isExpanded && (
                  <div style={{
                    border: '1px solid rgba(255,255,255,0.12)', borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    padding: 8,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
                      {source.lists.map(list => (
                        <SelectButton
                          key={list.id}
                          selected={selectedLists.includes(list.id)}
                          centered minHeight={38} fontSize={12}
                          onClick={() => setSelectedLists(prev => toggle(prev, list.id))}
                        >
                          {list.label}
                        </SelectButton>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {selectedLists.length === 0 && (
          <div style={{ color: '#f87171', fontSize: 12, fontFamily: 'inherit', marginTop: 6 }}>
            Select at least 1 list
          </div>
        )}

        {/* ── Separator + Additional Settings ── */}
        <div style={hairline} />
        <DrawerSectionHeader title="Additional Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DrawerCheckbox checked={showStreak}        onChange={() => setShowStreak(v => !v)}        label="Show streak" />
          <DrawerCheckbox checked={showFurigana}      onChange={() => setShowFurigana(v => !v)}      label="Show furigana" />
          <DrawerCheckbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <DrawerCheckbox checked={pixelFont}         onChange={() => setPixelFont(v => !v)}         label="Use pixel font" />
          <DrawerCheckbox checked={showTranslation}   onChange={() => setShowTranslation(v => !v)}   label="Show translation" />
          <DrawerCheckbox checked={showSentence}      onChange={() => setShowSentence(v => !v)}       label="Show sentence" />
          <DrawerCheckbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <DrawerCheckbox
                checked={ttsEnabled}
                onChange={() => setTtsEnabled(v => !v)}
                label="Text to speech"
                indent={1}
              >
                {ttsEnabled && jaVoices.length > 0 && (
                  <DrawerSelect
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </DrawerCheckbox>
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
            crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Vocabulary Training' }]}
            noBorder
            rightSlot={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setAudioEnabled(v => !v)}
                onMouseEnter={() => setAudioHovered(true)}
                onMouseLeave={() => setAudioHovered(false)}
                title={audioEnabled ? 'Mute audio' : 'Enable audio'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34,
                  background: audioHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, cursor: 'pointer',
                  opacity: audioEnabled ? 1 : 0.35, padding: 0,
                  transition: 'background 130ms', color: 'rgba(255,255,255,0.8)',
                  fontSize: 16,
                }}
              >
                {audioEnabled ? '🔊' : '🔇'}
              </button>
              <button
                onClick={() => setShowOptions(v => !v)}
                onMouseEnter={() => setOptionsHovered(true)}
                onMouseLeave={() => setOptionsHovered(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 34, padding: '0 12px', fontSize: 13,
                  fontFamily: 'inherit',
                  background: optionsHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, cursor: 'pointer',
                  transition: 'background 130ms',
                }}
              >
                {showOptions ? 'Hide options' : 'Show options'}
              </button>
            </div>}
          />
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
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 'min-content',
          }}>
            {!hasSelection ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Select a word list to begin</div>
            ) : pool.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No words in selected lists</div>
            ) : drill.done ? (
              <DoneScreen correct={drill.correct} troubled={drill.troubled} onRestart={drill.restart} onRedoTroubled={drill.redoTroubled} />
            ) : (
              <ActiveDrill
                drill={drill}
                ttsEnabled={audioEnabled && ttsEnabled}
                sfxEnabled={audioEnabled && sfxEnabled}
                ttsVoice={ttsVoice}
                showStreak={showStreak}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                showSentence={showSentence}
                pixelFont={pixelFont}
                showVisualEffects={showVisualEffects}
                onPulse={setPulseColor}
                isShort={isShort}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <>
          <div
            onClick={() => setShowOptions(v => !v)}
            onMouseEnter={() => setChevronHovered(true)}
            onMouseLeave={() => setChevronHovered(false)}
            style={{
              flexShrink: 0,
              width: CHEVRON_W,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: showOptions ? '1px solid rgba(255,255,255,0.1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: chevronHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition: 'background 130ms',
            }}>
            <button style={{
              width: CHEVRON_W, height: 44,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', padding: 0,
            }}>
              {showOptions ? '›' : '‹'}
            </button>
          </div>
          <div style={{
            flexShrink: 0,
            width: showOptions ? PANEL_CONTENT_W : 0,
            overflow: 'hidden',
            transition: 'width 220ms ease',
          }}>
            <div className="sidebar-scroll" style={{ width: PANEL_CONTENT_W, height: '100%', overflowY: 'auto' }} onFocus={handleSidebarFocus}>
              {renderPanelContent(16)}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile overlay ── */}
      {isMobile && showOptions && (
        <>
          <div onClick={() => setShowOptions(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20 }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 30, background: '#2E2E2E',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Options</div>
              <button
                onClick={() => setShowOptions(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                Back
              </button>
            </div>
            <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }} onFocus={handleSidebarFocus}>
              {renderPanelContent(20)}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
