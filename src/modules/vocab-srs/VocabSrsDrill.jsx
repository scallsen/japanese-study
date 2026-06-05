import { useState, useEffect, useRef } from 'react'
import FlipCard from '../../FlipCard.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, BORDER } from '../../data/theme.js'
import { Rating } from './srs.js'
import { answerCard, isComplete, getSessionStats } from './session.js'
import { useTTS } from '../../hooks/useTTS.js'
import { useSFX } from '../../hooks/useSFX.js'

const CARD_BG = '#E8E4DE'

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function SrsCardFace({ text, isBack, backText, showTranslation, pixelFont }) {
  const cardFont = pixelFont ? FONT : 'system-ui, sans-serif'
  return (
    <div style={{
      backgroundColor: CARD_BG,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '0 20px',
    }}>
      <div style={{
        fontFamily: cardFont,
        fontSize: isBack ? '10cqw' : '12.63cqw',
        color: '#222',
        letterSpacing: 'normal',
        lineHeight: 1.3,
        textShadow: '2px 2px 0 rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        {text}
      </div>
      {isBack && backText && showTranslation && (
        <div style={{
          fontFamily: cardFont,
          fontSize: '5.26cqw',
          color: '#555',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {backText}
        </div>
      )}
    </div>
  )
}

function DoneScreen({ stats, onDone }) {
  const btnBase = {
    padding: '10px 28px',
    fontSize: 14,
    fontFamily: FONT,
    letterSpacing: TRACKING,
    borderRadius: 8,
    cursor: 'pointer',
  }
  return (
    <div style={{ textAlign: 'center', fontFamily: FONT, letterSpacing: TRACKING }}>
      <div style={{ color: TEXT, fontSize: 28, marginBottom: 16 }}>Session complete</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ color: TEXT_MUTED, fontSize: 11, marginBottom: 4 }}>REVIEWED</div>
          <div style={{ color: TEXT, fontSize: 24 }}>{stats.goodCount}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 24, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: stats.againCount > 0 ? '#fbbf24' : TEXT_MUTED, fontSize: 11, marginBottom: 4 }}>AGAIN</div>
          <div style={{ color: stats.againCount > 0 ? '#fbbf24' : TEXT_MUTED, fontSize: 24 }}>{stats.againCount}</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 24, alignSelf: 'center' }}>·</div>
        <div>
          <div style={{ color: TEXT_MUTED, fontSize: 11, marginBottom: 4 }}>TIME</div>
          <div style={{ color: TEXT, fontSize: 24 }}>{formatTime(stats.elapsedSeconds)}</div>
        </div>
      </div>
      {stats.againCount > 0 && (
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 24 }}>
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
  showTranslation = true, pixelFont = true, showVisualEffects = true,
  ttsEnabled = false, sfxEnabled = true, ttsVoice = '',
  isMobile = false, onShowOptions,
}) {
  const [session, setSession] = useState(initialSession)
  const [localCards, setLocalCards] = useState(initialCards)
  const [flipped, setFlipped] = useState(false)
  const [backHovered, setBackHovered] = useState(false)
  const [optionsHovered, setOptionsHovered] = useState(false)

  const tts = useTTS(ttsVoice)
  const sfx = useSFX()

  const seenRef = useRef(new Set())
  const flippedRef = useRef(false)
  flippedRef.current = flipped

  const handleAnswerRef = useRef()
  handleAnswerRef.current = (rating) => {
    if (sfxEnabled) sfx.play(rating === Rating.Again ? 'flip_card_wrong' : 'flip_card_correct')
    tts.cancel()
    const currentCard = session.queue[0]
    seenRef.current.add(currentCard.id)
    const { session: newSession, updatedCard } = answerCard(session, currentCard, rating)
    const updatedCards = localCards.map(c => c.id === updatedCard.id ? updatedCard : c)
    setLocalCards(updatedCards)
    setSession(newSession)
    setFlipped(false)
    onCardSave(updatedCards)
  }

  const handleFlipRef = useRef()
  handleFlipRef.current = () => {
    if (sfxEnabled) sfx.play('flip_card')
    if (ttsEnabled) tts.speak(session.queue[0]?.front ?? '')
    setFlipped(true)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!flippedRef.current) handleFlipRef.current()
        return
      }
      if (!flippedRef.current) return
      if (e.code === 'KeyJ' || e.code === 'Digit1') handleAnswerRef.current(Rating.Again)
      if (e.code === 'KeyK' || e.code === 'Digit2') handleAnswerRef.current(Rating.Good)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const headerContent = (rightSlot) => (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: `1px solid ${BORDER}`,
      flexShrink: 0,
    }}>
      <span
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
        style={{
          color: backHovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
          fontSize: 16,
          cursor: 'pointer',
          letterSpacing: TRACKING,
          transition: 'color 130ms',
        }}
      >
        Japanese Study
      </span>
      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, margin: '0 6px' }}>/</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>SRS</span>
      {rightSlot}
    </header>
  )

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
        {headerContent(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {isMobile && onShowOptions && (
              <button
                onClick={onShowOptions}
                onMouseEnter={() => setOptionsHovered(true)}
                onMouseLeave={() => setOptionsHovered(false)}
                style={{
                  height: 34, padding: '0 12px', fontSize: 13,
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
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DoneScreen stats={stats} onDone={() => onDone(localCards, stats.goodCount)} />
        </div>
      </div>
    )
  }

  const currentCard = session.queue[0]
  const stats = getSessionStats(session)
  const progressPct = stats.total > 0 ? (stats.goodCount / stats.total) * 100 : 0
  const isRequeue = seenRef.current.has(currentCard.id)

  const front = <SrsCardFace text={currentCard.front} isBack={false} showTranslation={showTranslation} pixelFont={pixelFont} />
  const back = <SrsCardFace text={currentCard.front} isBack={true} backText={currentCard.back} showTranslation={showTranslation} pixelFont={pixelFont} />

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
      {headerContent(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <span style={{ fontSize: 13, color: TEXT_MUTED }}>
            {stats.goodCount} / {stats.total}
          </span>
          {isMobile && onShowOptions && (
            <button
              onClick={onShowOptions}
              onMouseEnter={() => setOptionsHovered(true)}
              onMouseLeave={() => setOptionsHovered(false)}
              style={{
                height: 34, padding: '0 12px', fontSize: 13,
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
      )}

      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: '#3ABDA4',
          transition: 'width 300ms ease',
        }} />
      </div>

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

        <div style={{ position: 'relative' }}>
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
                setFlipped(next)
                if (next) {
                  if (sfxEnabled) sfx.play('flip_card')
                  if (ttsEnabled) tts.speak(currentCard.front)
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

        {!flipped ? (
          <div style={{
            width: 'min(380px, calc(100vw - 32px))',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 13,
            padding: '10px 0',
          }}>
            Space or tap to flip
          </div>
        ) : (
          <div style={{ width: 'min(380px, calc(100vw - 32px))', display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleAnswerRef.current(Rating.Again)}
              className="verdict-btn"
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 14,
                fontFamily: 'inherit',
                letterSpacing: TRACKING,
                background: 'rgba(192,57,43,0.75)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Again [J]
            </button>
            <button
              onClick={() => handleAnswerRef.current(Rating.Good)}
              className="verdict-btn"
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 14,
                fontFamily: 'inherit',
                letterSpacing: TRACKING,
                background: 'rgba(39,174,96,0.75)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Good [K]
            </button>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          {stats.remaining} remaining
        </div>

      </div>
    </div>
  )
}
