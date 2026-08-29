import { useState } from 'react'
import { isBundledDeck } from '../modules/vocab-srs/deckUtils.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_HEADING } from '../data/theme.js'

const ACCENT = '#3ABDA4'
const SURFACE = '#2A2A2A'

function DeckOption({ deck, isLastUsed, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="deck-picker-row"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '12px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        color: TEXT,
        fontFamily: FONT,
        fontSize: FS_BASE,
        letterSpacing: TRACKING,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span>{deck.name}</span>
      {isLastUsed && (
        <span style={{ fontSize: FS_CAPTION, color: ACCENT, flexShrink: 0 }}>Last used</span>
      )}
    </button>
  )
}

export default function DeckPickerSheet({
  open,
  decks,
  lastUsedDeckId,
  onSelect,
  onCreateDeck,
  onClose,
  isMobile,
  title = 'Choose a deck',
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  function handleClose() {
    setCreating(false)
    setNewName('')
    setBusy(false)
    onClose()
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    await onCreateDeck(name)
    handleClose()
  }

  const deckList = Object.values(decks)
    .filter(d => !isBundledDeck(d))
    .sort((a, b) => {
      if (a.id === lastUsedDeckId) return -1
      if (b.id === lastUsedDeckId) return 1
      return (a.addedAt ?? 0) - (b.addedAt ?? 0)
    })

  const panelStyle = isMobile
    ? {
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
        animation: 'modal-slide-up 220ms ease-out',
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(420px, 92vw)',
        maxHeight: '70vh',
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        zIndex: 41,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        color: TEXT,
        animation: 'modal-fade-scale-in 160ms ease-out',
      }

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, animation: 'modal-backdrop-fade-in 160ms ease-out' }} />
      <div style={panelStyle}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        }}>
          <div style={{ fontSize: FS_HEADING, color: TEXT }}>{title}</div>
          <button
            onClick={handleClose}
            className="deck-picker-close-btn"
            style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: FS_BASE, fontFamily: FONT, cursor: 'pointer', padding: 4 }}
          >
            Close
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {deckList.length === 0 && !creating && (
            <div style={{ padding: '16px 18px', fontSize: FS_CAPTION, color: TEXT_MUTED }}>
              No decks yet — create one below.
            </div>
          )}
          {deckList.map(deck => (
            <DeckOption
              key={deck.id}
              deck={deck}
              isLastUsed={deck.id === lastUsedDeckId}
              onSelect={() => { onSelect(deck.id); handleClose() }}
            />
          ))}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          {creating ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Deck name"
                className="deck-picker-input"
                style={{
                  flex: 1,
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
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || busy}
                className="deck-picker-primary-btn"
                style={{
                  padding: '8px 14px',
                  fontSize: FS_BASE,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  background: 'rgba(58,189,164,0.18)',
                  color: ACCENT,
                  border: '1px solid rgba(58,189,164,0.45)',
                  borderRadius: 6,
                  cursor: !newName.trim() || busy ? 'default' : 'pointer',
                  opacity: !newName.trim() || busy ? 0.5 : 1,
                }}
              >
                Create
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="deck-picker-secondary-btn"
              style={{
                width: '100%',
                padding: '9px 14px',
                fontSize: FS_BASE,
                fontFamily: FONT,
                letterSpacing: TRACKING,
                background: 'rgba(255,255,255,0.05)',
                color: TEXT,
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              + Create new deck
            </button>
          )}
        </div>
      </div>
    </>
  )
}
