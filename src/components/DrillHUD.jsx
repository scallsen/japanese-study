import { useState, useEffect, useRef } from 'react'
import { FONT, FS_BASE, FS_CAPTION } from '../data/theme.js'

const KEYFRAMES_ID     = 'streak-keyframes'
const WIGGLE_THRESHOLD = 10
const WAVE_THRESHOLD   = 20

function streakFontSize(n) {
  return 20 + Math.min(n, 12)
}

function WaveText({ text, color }) {
  return text.split('').map((char, i) => (
    <span
      key={i}
      style={{
        display: 'inline-block',
        whiteSpace: 'pre',
        color,
        animation: `streak-wave 0.8s ease-in-out infinite`,
        animationDelay: `${-(i * 0.08)}s`,
      }}
    >
      {char}
    </span>
  ))
}

export default function DrillHUD({ streak, bestStreak, correct, troubled, remaining, canUndo, onUndo, showStreak, showVisualEffects = true, onboardingHint, errorMessage, streakLost, actionSlot, isShort, children }) {
  const [popCount,   setPopCount]   = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const prevStreakRef = useRef(streak)

  useEffect(() => {
    if (errorMessage != null) setErrorCount(c => c + 1)
  }, [errorMessage])

  useEffect(() => {
    if (!document.getElementById(KEYFRAMES_ID)) {
      const style = document.createElement('style')
      style.id = KEYFRAMES_ID
      style.textContent = [
        '@keyframes streak-pop     { 0% { transform: scale(1) } 40% { transform: scale(1.18) } 100% { transform: scale(1) } }',
        '@keyframes streak-wiggle  { 0%, 100% { transform: rotate(-0.8deg) } 50% { transform: rotate(0.8deg) } }',
        '@keyframes streak-wave    { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }',
        '@keyframes error-in       { 0% { transform: scale(0.7); opacity: 0 } 65% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }',
      ].join(' ')
      document.head.appendChild(style)
    }
    return () => document.getElementById(KEYFRAMES_ID)?.remove()
  }, [])

  useEffect(() => {
    const prev = prevStreakRef.current
    prevStreakRef.current = streak
    if (streak > prev) setPopCount(c => c + 1)
  }, [streak])

  const atBest   = streak > 0 && streak === bestStreak
  const subLabel = bestStreak === 0 ? null : atBest ? 'BEST STREAK' : `Best streak: ${bestStreak}`

  const showWiggle  = showVisualEffects && streak >= WIGGLE_THRESHOLD
  const showWave    = showVisualEffects && streak >= WAVE_THRESHOLD
  const streakText  = `Streak: ${streak}`
  const streakColor = streak > 0 ? '#fff' : 'transparent'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isShort ? 8 : 15 }}>

      <div style={{ minHeight: isShort ? 44 : 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, visibility: (showStreak || onboardingHint != null || errorMessage != null) ? 'visible' : 'hidden' }}>
        {errorMessage != null ? (
          <span key={errorCount} style={{ display: 'inline-block', fontSize: 20, fontWeight: 700, fontFamily: FONT, color: '#f87171', letterSpacing: '0.05em', lineHeight: 1.3, animation: 'error-in 0.22s ease-out' }}>
            {errorMessage}
          </span>
        ) : onboardingHint != null ? (
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: '#fff', letterSpacing: '0.05em', lineHeight: 1.3, textAlign: 'center', maxWidth: 'calc(100vw - 48px)', whiteSpace: 'pre-line' }}>
            {onboardingHint}
          </span>
        ) : streakLost ? (
          <span style={{ color: '#f87171', fontSize: 16, fontWeight: 700, fontFamily: FONT, opacity: streakLost === 'fading' ? 0 : 1, transition: 'opacity 0.3s ease' }}>
            Streak lost
          </span>
        ) : (
          <>
            <span style={{
              display: 'inline-block',
              fontSize: streakFontSize(streak),
              transition: showVisualEffects ? 'font-size 0.35s ease' : 'none',
              fontWeight: 700,
              fontFamily: FONT,
              letterSpacing: '0.05em',
              lineHeight: 1,
              animation: showWiggle ? 'streak-wiggle 1.4s ease-in-out infinite' : 'none',
            }}>
              <span
                key={popCount}
                style={{
                  display: 'inline-block',
                  userSelect: 'none',
                  animation: showVisualEffects && popCount > 0 ? 'streak-pop 0.18s ease-out' : 'none',
                }}
              >
                {showWave
                  ? <WaveText text={streakText} color={streakColor} />
                  : <span style={{ color: streakColor }}>{streakText}</span>
                }
              </span>
            </span>
            <span style={{ color: subLabel ? 'rgba(255,255,255,0.5)' : 'transparent', fontSize: FS_CAPTION, fontFamily: FONT, userSelect: 'none', lineHeight: 1 }}>
              {subLabel ?? `Best streak: 0`}
            </span>
          </>
        )}
      </div>

      <div>{children}</div>

      <div style={{ width: 'min(380px, calc(100vw - 32px))', marginTop: -5 }}>
        {actionSlot != null ? actionSlot : (
          <button
            onClick={canUndo ? onUndo : undefined}
            className="undo-btn"
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.55)',
              fontSize: FS_BASE,
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              visibility: canUndo ? 'visible' : 'hidden',
            }}
          >
            Undo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: FS_BASE, fontFamily: FONT, alignItems: 'center' }}>
        <span style={{ color: correct > 0 ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>{correct} Correct</span>
        <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <span style={{ color: troubled > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>{troubled} Troubled</span>
        <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{remaining} Remaining</span>
      </div>

    </div>
  )
}
