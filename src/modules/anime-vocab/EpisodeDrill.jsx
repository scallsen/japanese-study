import { useState, useEffect, useRef, useMemo } from 'react'
import * as SimpleQueue from '../../engines/simpleQueue.js'
import { useDrill } from '../../hooks/useDrill.js'
import { useTTS } from '../../hooks/useTTS.js'
import { useSFX } from '../../hooks/useSFX.js'
import VocabCard from '../../components/VocabCard.jsx'
import DrillHUD from '../../components/DrillHUD.jsx'
import SpeedModeControls from '../../components/SpeedModeControls.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { createCard } from '../vocab-srs/srs.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION,
  FS_DISPLAY_HEADING, FS_STAT_VALUE, FS_LIST_TITLE,
} from '../../data/theme.js'
import { useAccent } from '../../context/ModuleThemeContext.jsx'
import Button from '../../components/Button.jsx'

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
  const ACCENT = useAccent()
  const rows = useMemo(() =>
    pool.map(({ id, word }) => ({ id, word, mistakes: mistakeCounts[id] ?? 0 })).sort((a, b) => b.mistakes - a.mistakes),
    [pool, mistakeCounts]
  )
  const [selected, setSelected] = useState(() => new Set(rows.filter(r => r.mistakes > 0).map(r => r.id)))
  const [addedCount, setAddedCount] = useState(null)

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
        <Button variant="neutral" size="lg" onClick={onRestart}>Restart</Button>
        <Button variant="neutral" size="lg" onClick={onBack}>Back to episode</Button>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: 36, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em' }}>WORDS FROM THIS DRILL</span>
            {requiresSignIn ? (
              <Button variant="neutral" size="sm" onClick={onSignIn}>Sign in to add to SRS</Button>
            ) : (
              <Button variant="accent-outline" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
                Add {selected.size} to SRS
              </Button>
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

// words: [{ id, kanji, kana, english, sentence, jmdictId }]
// Display/audio settings are owned by AnimeVocabModule (not here) so it can
// host the settings sidebar at its own top level — see the comment on
// AnimeVocabModule's settings state for why.
export default function EpisodeDrill({
  words, onBack,
  ttsVoice, audioEnabled, sfxEnabled, disableKeyboard,
  showStreak, showFurigana, showTranslation, showSentence, sentenceSource, showKanjiMeaning, pixelFont, showVisualEffects,
}) {
  const pool = useMemo(() => words.map(w => ({ id: w.id, word: w })), [words])
  const drill = useDrill(pool, { engine: SimpleQueue })
  const { user, signIn } = useAuth()
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')

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
          disableKeyboard={disableKeyboard}
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
    </div>
  )
}
