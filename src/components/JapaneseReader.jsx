import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_ENTRY_WORD } from '../data/theme.js'

export function TokenizedBody({
  tokens,
  vocabMap,
  onWordClick,
  showFurigana,
  activeIdx,
  vocabHighlight = 'rgba(224,90,78,0.22)',
  hoverBg = 'rgba(255,255,255,0.1)',
  rtColor = TEXT_MUTED,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  useEffect(() => {
    if (activeIdx === null) setHoveredIdx(null)
  }, [activeIdx])

  if (!Array.isArray(tokens) || tokens.length === 0) return null
  return (
    <span>
      {tokens.map((tok, i) => {
        if (!tok.w) return <span key={i}>{tok.t}</span>
        const isActive = hoveredIdx === i || activeIdx === i
        const inVocab = !!vocabMap[tok.t]
        return (
          <span
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={e => { e.stopPropagation(); onWordClick(tok, e, i) }}
            style={{
              cursor: 'pointer',
              borderRadius: 3,
              background: isActive
                ? inVocab ? vocabHighlight : hoverBg
                : 'transparent',
              padding: '0 1px',
              transition: 'background 80ms',
            }}
          >
            {showFurigana && tok.r
              ? (
                <ruby>
                  {tok.t}
                  <rt style={{ fontSize: '0.55em', color: rtColor, letterSpacing: 0 }}>{tok.r}</rt>
                </ruby>
              )
              : tok.t}
          </span>
        )
      })}
    </span>
  )
}

export function WordPopup({ token, vocabEntry, onAddToSrs, onClose, anchorRect }) {
  const popupRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useLayoutEffect(() => {
    if (!popupRef.current || !anchorRect) return
    const el = popupRef.current
    const { width, height } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = anchorRect.bottom + 6
    let left = anchorRect.left

    if (left + width + 8 > vw) left = vw - width - 8
    left = Math.max(8, left)

    if (top + height + 8 > vh) top = anchorRect.top - height - 6
    top = Math.max(8, top)

    el.style.top = top + 'px'
    el.style.left = left + 'px'
  }, [anchorRect])

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: anchorRect ? anchorRect.bottom + 6 : 0,
        left: anchorRect ? anchorRect.left : 0,
        zIndex: 200,
        background: '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 160,
        maxWidth: 260,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}
    >
      <div style={{ fontSize: FS_ENTRY_WORD, color: TEXT, marginBottom: 2 }}>{token.t}</div>
      {token.r && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: (vocabEntry?.pos || vocabEntry?.meaning) ? 4 : 10 }}>{token.r}</div>
      )}
      {vocabEntry?.pos && (
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: vocabEntry.meaning ? 4 : 10, opacity: 0.7 }}>{vocabEntry.pos}</div>
      )}
      {vocabEntry?.meaning && (
        <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 10 }}>{vocabEntry.meaning}</div>
      )}
      <button
        onClick={() => onAddToSrs(token, vocabEntry)}
        style={{
          fontSize: FS_BASE,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          color: TEXT,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 5,
          padding: '4px 12px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Add to SRS
      </button>
    </div>
  )
}
