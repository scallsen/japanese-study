import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { isBundledDeck } from '../modules/vocab-srs/deckUtils.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_HEADING } from '../data/theme.js'

const ACCENT = '#3ABDA4'
const SURFACE = '#2A2A2A'

// A single control that merges "pick a deck" and "create a deck" into one
// type-to-filter-or-create popover (the GitHub-label / Notion-page-picker
// pattern). Picking an existing deck or creating a new one both add
// immediately — there is no separate "default deck" concept to manage.
export default function DeckComboBox({ decks, onAdd, onCreateAndAdd, isMobile, disabled = false, fullWidth = false, buttonLabel = 'Add to SRS', title = 'Add to which deck?' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open || isMobile) return
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, isMobile])

  // The desktop popover is `position: fixed` (not absolute-in-parent) so it can
  // never be clipped by a scrollable ancestor's overflow. Same flip-above/
  // clamp-horizontal technique as WordPopup in JapaneseReader.jsx: render at a
  // first-guess position below the button, then correct before paint once the
  // popover's real size is known, so there's no visible jump.
  useLayoutEffect(() => {
    if (!open || isMobile || !popoverRef.current || !buttonRef.current) return
    const anchorRect = buttonRef.current.getBoundingClientRect()
    const el = popoverRef.current
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
  }, [open, isMobile])

  // A `fixed` popover doesn't track the button if the page scrolls underneath
  // it, so close it on any scroll rather than show a stale position — same
  // outcome WordPopup's callers get via their own scroll listeners, but done
  // here (capture phase catches scroll on any ancestor, not just window)
  // since this component doesn't know which container its caller scrolls.
  useEffect(() => {
    if (!open || isMobile) return
    function handleScroll() { setOpen(false) }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open, isMobile])

  const deckList = Object.values(decks)
    .filter(d => !isBundledDeck(d))
    .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))

  const trimmedQuery = query.trim()
  const filtered = trimmedQuery
    ? deckList.filter(d => d.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : deckList
  const exactMatch = deckList.some(d => d.name.toLowerCase() === trimmedQuery.toLowerCase())
  const showCreateRow = trimmedQuery.length > 0 && !exactMatch

  function handleAdd(deckId) {
    onAdd(deckId)
    setOpen(false)
  }

  function handleCreate() {
    onCreateAndAdd(trimmedQuery)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter') {
      if (showCreateRow) handleCreate()
      else if (filtered.length > 0) handleAdd(filtered[0].id)
    }
  }

  const searchInput = (
    <input
      ref={inputRef}
      value={query}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Search or create a deck"
      className="deck-picker-input"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        color: TEXT,
        fontFamily: FONT,
        fontSize: FS_BASE,
        letterSpacing: TRACKING,
      }}
    />
  )

  const rows = (
    <>
      {showCreateRow && (
        <button
          onClick={handleCreate}
          className="deck-picker-row"
          style={{
            width: '100%',
            display: 'block',
            textAlign: 'left',
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            color: ACCENT,
            fontFamily: FONT,
            fontSize: FS_BASE,
            letterSpacing: TRACKING,
            cursor: 'pointer',
          }}
        >
          + Create &ldquo;{trimmedQuery}&rdquo;
        </button>
      )}
      {filtered.length === 0 && !showCreateRow && (
        <div style={{ padding: '10px 12px', fontSize: FS_CAPTION, color: TEXT_MUTED }}>No decks yet</div>
      )}
      {filtered.map(deck => (
        <button
          key={deck.id}
          onClick={() => handleAdd(deck.id)}
          className="deck-picker-row"
          style={{
            width: '100%',
            display: 'block',
            textAlign: 'left',
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            color: TEXT,
            fontFamily: FONT,
            fontSize: FS_BASE,
            letterSpacing: TRACKING,
            cursor: 'pointer',
          }}
        >
          {deck.name}
        </button>
      ))}
    </>
  )

  return (
    <div ref={rootRef} style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block', fontFamily: FONT, letterSpacing: TRACKING }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="done-btn"
        style={{
          width: fullWidth ? '100%' : undefined,
          padding: '8px 16px',
          fontSize: FS_BASE,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(58,189,164,0.15)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.1)' : 'rgba(58,189,164,0.4)'}`,
          borderRadius: 6,
          color: disabled ? 'rgba(255,255,255,0.2)' : ACCENT,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {buttonLabel}
      </button>

      {open && !isMobile && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 6,
            left: buttonRef.current?.getBoundingClientRect().left ?? 0,
            width: 260,
            background: SURFACE,
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 50,
            overflow: 'hidden',
            animation: 'deck-picker-fade-scale-in-top 120ms ease-out',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {searchInput}
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {rows}
          </div>
        </div>
      )}

      {open && isMobile && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, animation: 'deck-picker-backdrop-fade-in 160ms ease-out' }} />
          <div style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '80vh',
            background: SURFACE,
            border: '1px solid rgba(255,255,255,0.12)',
            borderBottom: 'none',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            zIndex: 41,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONT,
            letterSpacing: TRACKING,
            color: TEXT,
            paddingBottom: 'env(safe-area-inset-bottom)',
            animation: 'deck-picker-slide-up 220ms ease-out',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
            }}>
              <div style={{ fontSize: FS_HEADING, color: TEXT }}>{title}</div>
              <button
                onClick={() => setOpen(false)}
                className="deck-picker-close-btn"
                style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: FS_BASE, fontFamily: FONT, cursor: 'pointer', padding: 4 }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '12px 18px' }}>
              {searchInput}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {rows}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
