import { useState } from 'react'
import { isBundledDeck } from '../modules/vocab-srs/deckUtils.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_HEADING } from '../data/theme.js'

const ACCENT = '#3ABDA4'
const SURFACE = '#2A2A2A'
const HEIGHT = 40
const CREATE_VALUE = '__create__'

function CreateDeckModal({ open, onCreate, onCancel }) {
  const [name, setName] = useState('')
  if (!open) return null

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
  }

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, animation: 'modal-backdrop-fade-in 160ms ease-out' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(360px, 90vw)', background: SURFACE, border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, zIndex: 51, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
        padding: '20px 20px 16px', animation: 'modal-fade-scale-in 160ms ease-out',
      }}>
        <div style={{ fontSize: FS_HEADING, marginBottom: 12 }}>New deck</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          placeholder="Deck name"
          className="deck-picker-input"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: TEXT, fontFamily: FONT,
            fontSize: FS_BASE, letterSpacing: TRACKING, marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="confirm-dialog-cancel-btn" style={{ padding: '8px 16px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, background: 'rgba(255,255,255,0.05)', color: TEXT, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim()} className="deck-picker-primary-btn" style={{ padding: '8px 16px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, background: 'rgba(58,189,164,0.18)', color: ACCENT, border: '1px solid rgba(58,189,164,0.45)', borderRadius: 6, cursor: name.trim() ? 'pointer' : 'default', opacity: name.trim() ? 1 : 0.5 }}>
            Create
          </button>
        </div>
      </div>
    </>
  )
}

// A dropdown + action button fused into one segmented control (shared height,
// shared border, no gap) — the dropdown carries a "+ Create new deck" option
// that opens a small modal instead of selecting, rather than a separate chip.
export default function SegmentedDeckAdd({ decks, lastUsedDeckId, onSelectDefaultDeck, onCreateDeck, onAdd, addLabel = 'Add to SRS' }) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const deckList = Object.values(decks)
    .filter(d => !isBundledDeck(d))
    .sort((a, b) => {
      if (a.id === lastUsedDeckId) return -1
      if (b.id === lastUsedDeckId) return 1
      return (a.addedAt ?? 0) - (b.addedAt ?? 0)
    })

  function handleChange(e) {
    if (e.target.value === CREATE_VALUE) {
      setShowCreateModal(true)
      return
    }
    onSelectDefaultDeck(e.target.value)
  }

  function handleCreate(name) {
    onCreateDeck(name)
    setShowCreateModal(false)
  }

  return (
    <div style={{ display: 'inline-flex', height: HEIGHT, fontFamily: FONT, letterSpacing: TRACKING }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
        <select
          value={lastUsedDeckId ?? ''}
          onChange={handleChange}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            height: HEIGHT,
            boxSizing: 'border-box',
            background: 'rgba(58,189,164,0.1)',
            border: '1px solid rgba(58,189,164,0.3)',
            borderRight: 'none',
            borderTopLeftRadius: 6,
            borderBottomLeftRadius: 6,
            color: ACCENT,
            fontSize: FS_BASE,
            fontFamily: 'inherit',
            letterSpacing: TRACKING,
            padding: '0 26px 0 12px',
            cursor: 'pointer',
            minWidth: 140,
          }}
        >
          {deckList.map(d => (
            <option key={d.id} value={d.id} style={{ background: '#2E2E2E', color: '#fff' }}>
              {d.name}{d.id === lastUsedDeckId ? ' (last used)' : ''}
            </option>
          ))}
          <option disabled style={{ background: '#2E2E2E', color: TEXT_MUTED }}>──────────</option>
          <option value={CREATE_VALUE} style={{ background: '#2E2E2E', color: '#fff' }}>+ Create new deck</option>
        </select>
        <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <button
        onClick={onAdd}
        className="done-btn"
        style={{
          height: HEIGHT,
          boxSizing: 'border-box',
          padding: '0 18px',
          fontSize: FS_BASE,
          fontFamily: 'inherit',
          letterSpacing: TRACKING,
          background: 'rgba(58,189,164,0.18)',
          color: ACCENT,
          border: '1px solid rgba(58,189,164,0.45)',
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
          cursor: 'pointer',
        }}
      >
        {addLabel}
      </button>

      <CreateDeckModal open={showCreateModal} onCreate={handleCreate} onCancel={() => setShowCreateModal(false)} />
    </div>
  )
}
