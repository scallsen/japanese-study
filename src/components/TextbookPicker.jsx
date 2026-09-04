import { useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Badge from './Badge.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'
import { TEXTBOOKS } from '../data/textbooks.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_CAPTION, FS_LIST_TITLE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16,
} from '../data/theme.js'

const HAIRLINE = 'rgba(255,255,255,0.08)'
const SURFACE = '#2A2A2A'
const LIST_WIDTH = 200

// The "Change textbook" surface. Picking a book replaces the current one —
// the app is built around studying one textbook at a time, so this is a
// deliberate swap action, not a multi-select.
//
// Layout is the split browser: a list of books next to (or, on a phone,
// under) the selected book's cover, description and where to buy it. The
// alternatives that were tried and rejected are in the bench at
// #/dev/textbook-picker.
export default function TextbookPicker({ open, onClose, currentId, onSelect, wordCountFor }) {
  const isMobile = useIsMobile()
  return (
    <Modal open={open} onClose={onClose} title="Change textbook" size="lg" isMobile={isMobile} bodyPadding={0}>
      <TextbookBrowser
        currentId={currentId}
        onChoose={id => { onSelect(id); onClose() }}
        wordCountFor={wordCountFor}
        stacked={isMobile}
      />
    </Modal>
  )
}

/**
 * `stacked` puts the detail above a scrolling list instead of beside it.
 * It's a prop rather than an internal `useIsMobile` so the layout bench can
 * preview the phone arrangement at any window size.
 *
 * In stacked mode the detail block is `position: sticky` inside the modal
 * body's own scroll, so it and the confirm button stay put while the list
 * scrolls beneath them. The first attempt gave the browser `height: 100%`
 * and scrolled the list itself; measured on a 375×667 viewport the height
 * silently didn't resolve (the sheet is max-height-driven, so the body's
 * height is not definite and a percentage child falls back to auto), the
 * body scrolled instead, and the confirm button sat below the fold. Sticky
 * needs no definite height and no magic numbers.
 */
export function TextbookBrowser({ currentId, onChoose, wordCountFor, stacked = false }) {
  const accent = useAccent()
  const [selectedId, setSelectedId] = useState(currentId ?? TEXTBOOKS[0].id)
  const selected = TEXTBOOKS.find(b => b.id === selectedId) ?? TEXTBOOKS[0]
  const isCurrent = selected.id === currentId

  const hasWords = book => book.chapters.some(ch => (wordCountFor?.(ch.id) ?? 0) > 0)

  const detail = (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: SPACE_12,
      padding: SPACE_16,
      flex: stacked ? '0 0 auto' : 1,
      minWidth: 0,
      // Pinned to the top of the modal body's scroll so browsing the list
      // never scrolls away the book you're reading about. SURFACE, not
      // transparent, or the list would show through it.
      ...(stacked ? { position: 'sticky', top: 0, zIndex: 1, background: SURFACE } : null),
    }}>
      <div style={{ display: 'flex', gap: SPACE_16, alignItems: 'flex-start' }}>
        <Cover book={selected} size={stacked ? 64 : 96} accent={accent} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: FS_LIST_TITLE, color: TEXT }}>{selected.title}</div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_4 }}>
            {selected.chapters.length} chapters · {selected.publisher}
            {!hasWords(selected) && ' · no words yet'}
          </div>
          {isCurrent && <div style={{ marginTop: SPACE_8 }}><Badge tone="accent">Current</Badge></div>}
        </div>
      </div>

      <div style={{
        fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5,
        // Clamped on a phone so a long description can't crowd out the list;
        // there's room for the whole thing beside the list on desktop.
        ...(stacked ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null),
      }}>
        {selected.description}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_12, alignItems: 'baseline' }}>
        <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Buy:</span>
        {selected.purchase.map(link => (
          <a
            key={link.label}
            className="tb-buy"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: FS_CAPTION, color: accent, textDecoration: 'none' }}
          >
            {link.label} ↗
          </a>
        ))}
      </div>

      {!stacked && <div style={{ flex: 1, minHeight: SPACE_8 }} />}
      <Button fullWidth disabled={isCurrent} onClick={() => onChoose(selected.id)}>
        {isCurrent ? 'In use' : stacked ? `Use ${selected.title}` : 'Use this textbook'}
      </Button>
    </div>
  )

  const list = (
    <div style={{
      overflowY: 'auto',
      minHeight: 0,
      ...(stacked
        ? { borderTop: `1px solid ${HAIRLINE}` }
        : { width: LIST_WIDTH, flexShrink: 0, borderRight: `1px solid ${HAIRLINE}` }),
    }}>
      {TEXTBOOKS.map(book => {
        const isSelected = book.id === selected.id
        return (
          <button
            key={book.id}
            type="button"
            className="tb-row"
            onClick={() => setSelectedId(book.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: SPACE_8,
              width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: stacked ? `${SPACE_8}px ${SPACE_12}px` : `10px ${SPACE_12}px`,
              border: 'none',
              borderLeft: `2px solid ${isSelected ? accent : 'transparent'}`,
              background: isSelected ? 'rgba(255,255,255,0.05)' : 'none',
              fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_CAPTION,
              color: isSelected ? TEXT : 'rgba(255,255,255,0.7)',
            }}
          >
            {stacked && <Cover book={book} size={28} accent={accent} />}
            <span style={{ flex: 1, minWidth: 0 }}>{book.title}</span>
            {book.id === currentId && <span style={{ color: accent }}>•</span>}
          </button>
        )
      })}
    </div>
  )

  if (!stacked) {
    return (
      <div style={{ display: 'flex', minHeight: 380 }}>
        {list}
        {detail}
      </div>
    )
  }

  return (
    <div>
      {detail}
      {list}
    </div>
  )
}

function Cover({ book, size, accent }) {
  if (!book.icon) {
    return (
      <div style={{
        width: size, height: size, flexShrink: 0, borderRadius: 4,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${HAIRLINE}`,
        borderLeft: `${Math.max(2, Math.round(size / 16))}px solid ${accent}`,
      }} />
    )
  }
  return <img src={book.icon} alt="" style={{ width: size, height: size, flexShrink: 0, imageRendering: 'pixelated' }} />
}
