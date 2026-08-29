import { useState, useRef, useEffect } from 'react'
import TextInput from './TextInput.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, SPACE_8 } from '../data/theme.js'

const ACCENT = '#3ABDA4'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const ROW_HAIRLINE = 'rgba(255,255,255,0.06)'

/**
 * A searchable list of options with an optional inline "create what you
 * typed" row — the GitHub-label / Notion-page-picker pattern.
 *
 * Deliberately owns no positioning and no domain knowledge, so it can render
 * inside a `Popover`, inside a `Modal`, or plain inline as one view of a
 * surface that has several. That last case is why this is separate from
 * `DeckComboBox`: `WordPopup` swaps its own content from definition to deck
 * list in place, which it couldn't do while the picker insisted on being its
 * own floating layer.
 *
 * `items`: [{ id, label, meta? }] — `meta` renders right-aligned and muted
 * (e.g. "Last used").
 * `onCreate`: omit entirely to get a pick-only list with no create row.
 */
export default function OptionPicker({
  items,
  onSelect,
  onCreate,
  placeholder = 'Search…',
  emptyMessage = 'Nothing here yet',
  createLabel = query => `+ Create “${query}”`,
  autoFocus = true,
  maxHeight = 240,
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => inputRef.current?.focus())
  }, [autoFocus])

  const trimmed = query.trim()
  const filtered = trimmed
    ? items.filter(i => i.label.toLowerCase().includes(trimmed.toLowerCase()))
    : items
  const exactMatch = items.some(i => i.label.toLowerCase() === trimmed.toLowerCase())
  const showCreate = !!onCreate && trimmed.length > 0 && !exactMatch

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    if (showCreate) onCreate(trimmed)
    else if (filtered.length > 0) onSelect(filtered[0].id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: SPACE_8, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
        <TextInput
          ref={inputRef}
          value={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ maxHeight, overflowY: 'auto' }}>
        {showCreate && (
          <Row onClick={() => onCreate(trimmed)} color={ACCENT}>
            {createLabel(trimmed)}
          </Row>
        )}

        {filtered.length === 0 && !showCreate && (
          <div style={{ padding: '10px 12px', fontSize: FS_CAPTION, color: TEXT_MUTED }}>
            {emptyMessage}
          </div>
        )}

        {filtered.map(item => (
          <Row key={item.id} onClick={() => onSelect(item.id)} meta={item.meta}>
            {item.label}
          </Row>
        ))}
      </div>
    </div>
  )
}

function Row({ onClick, color = TEXT, meta, children }) {
  return (
    <button
      onClick={onClick}
      className="option-picker-row"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        textAlign: 'left',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${ROW_HAIRLINE}`,
        color,
        fontFamily: FONT,
        fontSize: FS_BASE,
        letterSpacing: TRACKING,
        cursor: 'pointer',
      }}
    >
      <span>{children}</span>
      {meta && <span style={{ fontSize: FS_CAPTION, color: ACCENT, flexShrink: 0 }}>{meta}</span>}
    </button>
  )
}
