import { useState } from 'react'
import { isBundledDeck } from '../modules/vocab-srs/deckUtils.js'
import Button from './Button.jsx'
import Popover from './Popover.jsx'
import OptionPicker from './OptionPicker.jsx'
import { deckPickerItems } from './deckPickerItems.js'
import { TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_ENTRY_WORD, SPACE_8, SPACE_12 } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

// Hover is a CSS class (.reader-token) per the StrictMode rule, not a
// hovered-index useState as it was originally. The two highlight colours are
// themeable per call site (Story's light newspaper/letter layouts pass their
// own), so they travel as CSS custom properties on the wrapper for the
// :hover rules to read — a class can't otherwise take per-instance colours.
// `vocabHighlight` defaults to the module accent; it was Immersion's red
// hardcoded, which only looked right because Immersion was the first reader.
export function TokenizedBody({
  tokens,
  vocabMap,
  onWordClick,
  showFurigana,
  activeIdx,
  vocabHighlight,
  hoverBg = 'rgba(255,255,255,0.1)',
  rtColor = TEXT_MUTED,
}) {
  const accent = useAccent()
  const vocabBg = vocabHighlight ?? `${accent}38`

  if (!Array.isArray(tokens) || tokens.length === 0) return null
  return (
    <span style={{ '--reader-hover': hoverBg, '--reader-vocab': vocabBg }}>
      {tokens.map((tok, i) => {
        if (!tok.w) return <span key={i}>{tok.t}</span>
        const isActive = activeIdx === i
        const inVocab = !!vocabMap[tok.t]
        return (
          <span
            key={i}
            className={inVocab ? 'reader-token reader-token--vocab' : 'reader-token'}
            onClick={e => { e.stopPropagation(); onWordClick(tok, e, i) }}
            style={{
              cursor: 'pointer',
              borderRadius: 3,
              background: isActive
                ? inVocab ? vocabBg : hoverBg
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

export function WordPopup({ token, vocabEntry, onAdd, onCreateAndAdd, decks, isMobile, onClose, anchorRect, lastUsedDeckId }) {
  // The deck list is a second *view of this same surface*, not a second
  // floating layer. Previously this popup rendered a DeckComboBox, which
  // opened its own popover anchored to a button inside this one — two
  // stacked layers with competing click-outside handlers and independent
  // positioning. Swapping content in place removes that entirely.
  const [view, setView] = useState('definition')

  function close() {
    setView('definition')
    onClose()
  }

  return (
    <Popover
      open
      onClose={close}
      anchorRect={anchorRect}
      isMobile={isMobile}
      title={view === 'deck' ? 'Add to which deck?' : token.t}
      bodyPadding={view === 'deck' ? 0 : undefined}
    >
      {view === 'deck' ? (
        <OptionPicker
          items={deckPickerItems(decks, { lastUsedDeckId, exclude: isBundledDeck })}
          onSelect={deckId => { onAdd(token, vocabEntry, deckId); close() }}
          onCreate={name => { onCreateAndAdd(token, vocabEntry, name); close() }}
          placeholder="Search or create a deck"
          emptyMessage="No decks yet"
        />
      ) : (
        <div style={{ padding: `${SPACE_8}px ${SPACE_12}px`, minWidth: 160 }}>
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
          <Button variant="accent-outline" fullWidth onClick={() => setView('deck')}>
            Add to SRS
          </Button>
        </div>
      )}
    </Popover>
  )
}
