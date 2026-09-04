import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import { FONT, TRACKING, TEXT, FS_BASE } from '../data/theme.js'

const SURFACE = '#2A2A2A'
// PageHeader always renders a fixed 64px row (plus its own safe-area padding) —
// the top variants sit directly under it so they read as an extension of it.
const HEADER_H = 'calc(64px + env(safe-area-inset-top))'
const EXIT_MS = 200

const VARIANT_STYLES = {
  'bottom-bar': {
    left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    padding: '14px 24px',
    background: SURFACE,
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  'bottom-card': {
    left: '50%', bottom: 24,
    padding: '12px 18px',
    background: SURFACE,
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    maxWidth: 'min(420px, 90vw)',
  },
  'top-bar': {
    left: 0, right: 0, top: HEADER_H,
    justifyContent: 'center',
    padding: '12px 24px',
    background: SURFACE,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  'top-card': {
    left: '50%', top: `calc(${HEADER_H} + 12px)`,
    padding: '12px 18px',
    background: SURFACE,
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    maxWidth: 'min(420px, 90vw)',
  },
}

const ANIMATIONS = {
  'bottom-bar': 'toast-slide-up-in',
  'bottom-card': 'toast-slide-up-in-centered',
  'top-bar': 'toast-slide-down-in',
  'top-card': 'toast-slide-down-in-centered',
}

// Exit direction mirrors entrance — a toast that slid up into place slides
// back down out of view (and vice versa for the top variants) rather than
// just fading in place.
const EXIT_ANIMATIONS = {
  'bottom-bar': 'toast-slide-down-out',
  'bottom-card': 'toast-slide-down-out-centered',
  'top-bar': 'toast-slide-up-out',
  'top-card': 'toast-slide-up-out-centered',
}

const IS_CARD = { 'bottom-bar': false, 'bottom-card': true, 'top-bar': false, 'top-card': true }

// A single reusable confirmation toast — "Added N words to X", with an
// optional inline action (e.g. Undo) — auto-dismissing after `duration`.
// `variant` picks where and how wide it renders; see ToastLabPage for a
// side-by-side comparison of all four before wiring one in for real.
export default function Toast({ open, message, actionLabel, onAction, onDismiss, duration = 5000, variant = 'bottom-card' }) {
  const [closing, setClosing] = useState(false)
  const dismissTimerRef = useRef(null)
  const exitTimerRef = useRef(null)

  // The same Toast instance is reused across successive toasts (ToastContext
  // only toggles `open`, it never remounts), so `closing` can still be true
  // from a just-finished exit when a new one opens. useLayoutEffect (not
  // useEffect) resets it before the browser paints, so that stale frame is
  // never shown — otherwise the new toast briefly plays its exit animation
  // (looks like a snap-down) before switching to its entrance animation.
  useLayoutEffect(() => {
    if (!open) return
    setClosing(false)
    dismissTimerRef.current = setTimeout(startClose, duration)
    return () => clearTimeout(dismissTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message])

  useEffect(() => () => clearTimeout(exitTimerRef.current), [])

  function startClose() {
    clearTimeout(dismissTimerRef.current)
    setClosing(true)
    exitTimerRef.current = setTimeout(() => onDismiss(), EXIT_MS)
  }

  function handleAction() {
    onAction?.()
    startClose()
  }

  if (!open) return null

  const isCard = IS_CARD[variant]

  // Both controls are Buttons rather than bare <button>s so they pick up the
  // system's hover/active states — previously neither gave any feedback on
  // hover, so they didn't read as interactive.
  const content = (
    <>
      <span>{message}</span>
      {actionLabel && (
        <Button variant="ghost" size="sm" onClick={handleAction}>
          {actionLabel}
        </Button>
      )}
      <Button variant="ghost-muted" size="sm" onClick={startClose} label="Dismiss" icon="×" />
    </>
  )

  // top-bar reads as an extension of the header, so it must appear to slide
  // out from underneath it rather than drop in from above it. An outer
  // overflow:hidden clipper pinned to the header's bottom edge auto-sizes to
  // the bar's own (untransformed) height, so the bar's translateY(-100%)
  // start position is clipped away instead of showing above that edge.
  if (variant === 'top-bar') {
    return (
      <div style={{ position: 'fixed', top: HEADER_H, left: 0, right: 0, overflow: 'hidden', zIndex: 70, pointerEvents: 'none' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          fontSize: FS_BASE,
          color: TEXT,
          padding: '12px 24px',
          background: SURFACE,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          animation: closing
            ? `toast-slide-up-out ${EXIT_MS}ms ease-in forwards`
            : 'toast-slide-down-in 220ms ease-out',
          pointerEvents: 'auto',
        }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    // .toast-card widens the card variants to fill the viewport on phones
    // (see global.css). It's done by widening rather than by repositioning so
    // the centred slide-in/out keyframes keep working untouched.
    <div
      className={isCard ? 'toast-card' : undefined}
      style={{
        position: 'fixed',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        fontSize: FS_BASE,
        color: TEXT,
        animation: closing
          ? `${EXIT_ANIMATIONS[variant]} ${EXIT_MS}ms ease-in forwards`
          : `${ANIMATIONS[variant]} 220ms ease-out`,
        transform: isCard ? 'translateX(-50%)' : undefined,
        ...VARIANT_STYLES[variant],
      }}
    >
      {content}
    </div>
  )
}
