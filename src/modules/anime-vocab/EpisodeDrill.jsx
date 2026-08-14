import { useState, useEffect, useRef, useMemo } from 'react'
import * as SimpleQueue from '../../engines/simpleQueue.js'
import { useDrill } from '../../hooks/useDrill.js'
import { useTTS, useJaVoices } from '../../hooks/useTTS.js'
import { useSFX } from '../../hooks/useSFX.js'
import VocabCard from '../../components/VocabCard.jsx'
import DrillHUD from '../../components/DrillHUD.jsx'
import SpeedModeControls from '../../components/SpeedModeControls.jsx'
import DrawerSectionHeader from '../../components/DrawerSectionHeader.jsx'
import DrawerCheckbox from '../../components/DrawerCheckbox.jsx'
import DrawerSelect from '../../components/DrawerSelect.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { createCard } from '../vocab-srs/srs.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { SENTENCE_SOURCE_OPTIONS, DEFAULT_SENTENCE_SOURCE } from '../../data/sentenceSource.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION,
  FS_DISPLAY_HEADING, FS_STAT_VALUE, FS_LIST_TITLE,
} from '../../data/theme.js'

const ACCENT = '#D46EA3'
const ANIME_WORDS_DECK_ID = 'anime-words'

// One-off drill session — same tech/flow as Vocab Drill's speed mode
// (FlipCard/VocabCard/DrillHUD/SpeedModeControls/useDrill+SimpleQueue), just
// self-contained inside this module and not persisted to any SRS deck unless
// the user explicitly adds words from the done screen. Deliberately skips
// gamepad support — Vocab Drill specific, not core to the flow.
function ActiveEpisodeDrill({
  drill, ttsVoice, audioEnabled, sfxEnabled, disableKeyboard,
  showStreak, showFurigana, showTranslation, showSentence, sentenceSource, showKanjiMeaning, pixelFont, showVisualEffects,
}) {
  const [flippedCardId, setFlippedCardId] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const { currentCard, streak, bestStreak, correct, troubled, remaining, canUndo, onUndo } = drill
  const isFlipped = flippedCardId === currentCard.id
  const tts = useTTS(ttsVoice)
  const sfx = useSFX()

  const transitioningRef = useRef(false)
  useEffect(() => { transitioningRef.current = transitioning }, [transitioning])
  const isFlippedRef = useRef(isFlipped)
  useEffect(() => { isFlippedRef.current = isFlipped }, [isFlipped])

  const handleVerdictRef = useRef()
  handleVerdictRef.current = (isCorrect) => {
    if (transitioningRef.current) return
    const action = isCorrect ? drill.onCorrect : drill.onWrong
    if (sfxEnabled) sfx.play(isCorrect ? 'flip_card_correct' : 'flip_card_wrong')
    setTransitioning(true)
    setTimeout(() => { action() }, 200)
    setTimeout(() => { setTransitioning(false) }, 240)
  }

  useEffect(() => {
    if (isFlipped) { if (audioEnabled) tts.speak(currentCard.word.kana) }
    else tts.cancel()
    return () => tts.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, currentCard.id, audioEnabled])

  useEffect(() => { setFlippedCardId(null) }, [currentCard.id])

  function handleFlip(next) {
    if (sfxEnabled) sfx.play('flip_card')
    setFlippedCardId(next ? currentCard.id : null)
  }

  function handleUndo() {
    if (transitioningRef.current || !canUndo) return
    if (sfxEnabled) sfx.play('undo')
    setFlippedCardId(null)
    onUndo()
  }

  useEffect(() => {
    function onKey(e) {
      if (transitioningRef.current || disableKeyboard) return
      const t = e.target
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (sfxEnabled) sfx.play('flip_card')
        setFlippedCardId(prev => (prev === currentCard.id ? null : currentCard.id))
      } else if (e.code === 'KeyZ' && isFlippedRef.current) {
        handleVerdictRef.current(false)
      } else if (e.code === 'KeyX' && isFlippedRef.current) {
        handleVerdictRef.current(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard.id, sfxEnabled, disableKeyboard])

  return (
    <DrillHUD
      streak={streak}
      bestStreak={bestStreak}
      correct={correct}
      troubled={troubled}
      remaining={remaining}
      canUndo={canUndo}
      onUndo={handleUndo}
      showStreak={showStreak}
      showVisualEffects={showVisualEffects}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
        <VocabCard
          word={currentCard.word}
          flipped={isFlipped}
          onFlip={handleFlip}
          animate={showVisualEffects}
          reviewMode="kanji-front"
          showFurigana={showFurigana}
          showTranslation={showTranslation}
          showSentence={showSentence}
          sentenceSource={sentenceSource}
          showKanjiMeaning={showKanjiMeaning}
          pixelFont={pixelFont}
        />
        <SpeedModeControls isFlipped={isFlipped} transitioning={transitioning} onVerdict={v => handleVerdictRef.current(v)} />
      </div>
    </DrillHUD>
  )
}

function DoneScreen({ pool, mistakeCounts, correct, troubled, onRestart, onBack, onAddToSrs, requiresSignIn, onSignIn }) {
  const rows = useMemo(() =>
    pool.map(({ id, word }) => ({ id, word, mistakes: mistakeCounts[id] ?? 0 })).sort((a, b) => b.mistakes - a.mistakes),
    [pool, mistakeCounts]
  )
  const [selected, setSelected] = useState(() => new Set(rows.filter(r => r.mistakes > 0).map(r => r.id)))
  const [addedCount, setAddedCount] = useState(null)

  const btnBase = { padding: '10px 28px', fontSize: FS_BASE, fontFamily: 'inherit', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.05em' }

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
      <div style={{ color: '#fff', fontSize: FS_DISPLAY_HEADING, letterSpacing: '0.05em', marginBottom: 16 }}>Drill complete</div>
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
        <button onClick={onRestart} style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
          Restart
        </button>
        <button onClick={onBack} style={{ ...btnBase, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Back to episode
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 36, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>WORDS FROM THIS DRILL</span>
            {requiresSignIn ? (
              <button onClick={onSignIn} style={{ ...btnBase, padding: '6px 16px', fontSize: FS_CAPTION, background: 'rgba(255,255,255,0.06)', color: TEXT_MUTED, border: '1px solid rgba(255,255,255,0.15)' }}>
                Sign in to add to SRS
              </button>
            ) : (
              <button
                onClick={handleAdd}
                disabled={selected.size === 0}
                style={{
                  ...btnBase, padding: '6px 16px', fontSize: FS_CAPTION,
                  background: selected.size > 0 ? 'rgba(212,110,163,0.15)' : 'rgba(255,255,255,0.04)',
                  color: selected.size > 0 ? ACCENT : 'rgba(255,255,255,0.2)',
                  border: `1px solid ${selected.size > 0 ? 'rgba(212,110,163,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Add {selected.size} to SRS
              </button>
            )}
          </div>
          {addedCount !== null && (
            <div style={{ fontSize: FS_CAPTION, color: ACCENT, marginBottom: 8 }}>
              {addedCount > 0 ? `Added ${addedCount} word${addedCount === 1 ? '' : 's'} to Anime Words.` : 'Selected words are already in Anime Words.'}
            </div>
          )}
          <div style={{ background: '#2A2A2A', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {rows.map(row => (
              <label key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: requiresSignIn ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: TRACKING }}>
                <input type="checkbox" checked={selected.has(row.id)} disabled={requiresSignIn} onChange={() => toggleRow(row.id)} style={{ flexShrink: 0, width: 16, height: 16, accentColor: ACCENT }} />
                <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: 0, flexShrink: 0 }}>{row.word.kanji || row.word.kana}</span>
                <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.word.english}</span>
                {row.mistakes > 0 && <span style={{ fontSize: FS_BADGE, color: '#fbbf24', flexShrink: 0 }}>{row.mistakes}×</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const DRAWER_CHEVRON_W = 28
const DRAWER_PANEL_W = 'min(320px, 92vw)'

// Settings drawer — mirrors Vocab Drill's own desktop sidebar: a persistent
// edge tab that slides a panel in/out (no backdrop, no separate open/close
// button — the tab itself is both). Pinned to the viewport edge with
// `position: fixed` rather than docked in-flow like VocabPage's, since this
// module doesn't own its page's overall layout — it's embedded content
// inside AnimeVocabModule's scroll area — so a fixed tab is what keeps it
// reachable regardless of scroll position, on both desktop and mobile with
// one implementation.
//
// Reuses Vocab Drill's own localStorage keys (vocab-*) rather than a
// separate anime-vocab-* namespace, so display/audio preferences carry over
// between the two drills automatically, in both directions.
//
// No "Text to speech" (Voicevox) source picker like VocabPage's — Anime Vocab
// words are drawn from episode vocabulary, never Voicevox-pre-generated, so
// that control would always silently do nothing. Just the browser-voice
// picker (vocab-tts-voice) is exposed here, under the same "Enable audio"
// checkbox VocabPage uses.
function SettingsDrawer({
  open, onToggle, jaVoices,
  showStreak, setShowStreak, showFurigana, setShowFurigana, showVisualEffects, setShowVisualEffects,
  pixelFont, setPixelFont, showTranslation, setShowTranslation, showSentence, setShowSentence,
  sentenceSource, setSentenceSource, showKanjiMeaning, setShowKanjiMeaning,
  audioEnabled, setAudioEnabled, sfxEnabled, setSfxEnabled, ttsVoice, setTtsVoice,
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed', top: '50%', right: open ? DRAWER_PANEL_W : 0, transform: 'translateY(-50%)',
          width: DRAWER_CHEVRON_W, height: 56, zIndex: 46,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
          cursor: 'pointer', transition: 'right 220ms ease, background 130ms',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: FS_BASE, fontFamily: 'inherit' }}>{open ? '›' : '‹'}</span>
      </div>
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: DRAWER_PANEL_W, zIndex: 45,
        background: '#2E2E2E', borderLeft: '1px solid rgba(255,255,255,0.1)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms ease',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
                {jaVoices.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                    <DrawerSelect
                      value={ttsVoice}
                      onChange={setTtsVoice}
                      options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                      label="Voice"
                      subtext="Availability based on your device or browser"
                    />
                  </div>
                )}
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
      </div>
    </>
  )
}

// words: [{ id, kanji, kana, english, sentence, jmdictId }]
export default function EpisodeDrill({ words, onBack }) {
  const pool = useMemo(() => words.map(w => ({ id: w.id, word: w })), [words])
  const drill = useDrill(pool, { engine: SimpleQueue })
  const { user, signIn } = useAuth()
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')
  const jaVoices = useJaVoices()

  const [showOptions, setShowOptions] = useState(false)
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
  const [audioEnabled,     setAudioEnabled]     = useState(() => {
    const s = safeLocalStorageGet('vocab-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [sfxEnabled,       setSfxEnabled]       = useState(() => {
    const s = safeLocalStorageGet('vocab-sfx-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsVoice,         setTtsVoice]         = useState(() => safeLocalStorageGet('vocab-tts-voice') ?? '')

  useEffect(() => { safeLocalStorageSet('vocab-show-streak',       showStreak) },        [showStreak])
  useEffect(() => { safeLocalStorageSet('vocab-show-furigana',     showFurigana) },       [showFurigana])
  useEffect(() => { safeLocalStorageSet('vocab-visual-effects',    showVisualEffects) },  [showVisualEffects])
  useEffect(() => { safeLocalStorageSet('vocab-pixel-font',        pixelFont) },          [pixelFont])
  useEffect(() => { safeLocalStorageSet('vocab-show-translation',  showTranslation) },    [showTranslation])
  useEffect(() => { safeLocalStorageSet('vocab-show-sentence',     showSentence) },       [showSentence])
  useEffect(() => { safeLocalStorageSet('vocab-sentence-source',   sentenceSource) },     [sentenceSource])
  useEffect(() => { safeLocalStorageSet('vocab-show-kanji-meaning', showKanjiMeaning) },  [showKanjiMeaning])
  useEffect(() => { safeLocalStorageSet('vocab-audio-enabled',     audioEnabled) },       [audioEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-sfx-enabled',       sfxEnabled) },         [sfxEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-tts-voice',         ttsVoice) },           [ttsVoice])

  function handleAddToSrs(addedWords) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = { ...current.decks }
    if (!decks[ANIME_WORDS_DECK_ID]) {
      decks[ANIME_WORDS_DECK_ID] = { id: ANIME_WORDS_DECK_ID, name: 'Anime Words', active: true, source: 'imported', addedAt: Date.now() }
    }
    const existingFronts = new Set(Object.values(current.cards).filter(c => c.deckId === ANIME_WORDS_DECK_ID).map(c => c.front))
    const newCards = {}
    let addedCount = 0
    addedWords.forEach((word, i) => {
      const front = word.kanji || word.kana
      if (existingFronts.has(front)) return
      existingFronts.add(front)
      const cardId = `${ANIME_WORDS_DECK_ID}-${Date.now()}-${i}`
      const extras = {}
      if (word.kana) extras.kana = word.kana
      if (word.jmdictId) extras.jmdictId = word.jmdictId
      newCards[cardId] = createCard(front, word.english, cardId, ANIME_WORDS_DECK_ID, extras)
      addedCount++
    })
    if (addedCount > 0) saveSrs({ ...current, decks, cards: { ...current.cards, ...newCards } })
    return addedCount
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {drill.done ? (
        <DoneScreen
          pool={pool}
          mistakeCounts={drill.mistakeCounts}
          correct={drill.correct}
          troubled={drill.troubled}
          onRestart={drill.restart}
          onBack={onBack}
          onAddToSrs={handleAddToSrs}
          requiresSignIn={!user}
          onSignIn={signIn}
        />
      ) : (
        <ActiveEpisodeDrill
          drill={drill}
          ttsVoice={ttsVoice}
          audioEnabled={audioEnabled}
          sfxEnabled={audioEnabled && sfxEnabled}
          disableKeyboard={showOptions}
          showStreak={showStreak}
          showFurigana={showFurigana}
          showTranslation={showTranslation}
          showSentence={showSentence}
          sentenceSource={sentenceSource}
          showKanjiMeaning={showKanjiMeaning}
          pixelFont={pixelFont}
          showVisualEffects={showVisualEffects}
        />
      )}

      <SettingsDrawer
        open={showOptions}
        onToggle={() => setShowOptions(v => !v)}
        jaVoices={jaVoices}
        showStreak={showStreak} setShowStreak={setShowStreak}
        showFurigana={showFurigana} setShowFurigana={setShowFurigana}
        showVisualEffects={showVisualEffects} setShowVisualEffects={setShowVisualEffects}
        pixelFont={pixelFont} setPixelFont={setPixelFont}
        showTranslation={showTranslation} setShowTranslation={setShowTranslation}
        showSentence={showSentence} setShowSentence={setShowSentence}
        sentenceSource={sentenceSource} setSentenceSource={setSentenceSource}
        showKanjiMeaning={showKanjiMeaning} setShowKanjiMeaning={setShowKanjiMeaning}
        audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled}
        sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled}
        ttsVoice={ttsVoice} setTtsVoice={setTtsVoice}
      />
    </div>
  )
}
