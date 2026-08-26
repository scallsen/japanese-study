import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SegmentedDeckAdd from '../components/SegmentedDeckAdd.jsx'
import DeckPickerSheet from '../components/DeckPickerSheet.jsx'
import DeckComboBox from '../components/DeckComboBox.jsx'
import { createDeck } from '../modules/vocab-srs/deckUtils.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_HEADING } from '../data/theme.js'

const ACCENT = '#3ABDA4'
const SURFACE = '#2A2A2A'
const BG = '#1E1E1E'

function seedDecks() {
  const now = Date.now()
  return {
    'vocab-drill-words': { id: 'vocab-drill-words', name: 'Vocab Drill Words', active: true, source: 'imported', addedAt: now - 3000 },
    'immersion-words': { id: 'immersion-words', name: 'Immersion Words', active: true, source: 'imported', addedAt: now - 2000 },
    'story-words': { id: 'story-words', name: 'Story Words', active: true, source: 'imported', addedAt: now - 1000 },
  }
}

function ActivityLog({ entries }) {
  if (entries.length === 0) {
    return <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Nothing yet — try the control above.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map((entry, i) => (
        <div key={i} style={{ fontSize: FS_CAPTION, color: i === 0 ? ACCENT : TEXT_MUTED }}>
          {entry}
        </div>
      ))}
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: FS_HEADING, color: TEXT, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 20, lineHeight: 1.5, maxWidth: 560 }}>{description}</div>
      {children}
    </div>
  )
}

function OptionOne() {
  const [decks, setDecks] = useState(seedDecks)
  const [lastUsedDeckId, setLastUsedDeckId] = useState('immersion-words')
  const [log, setLog] = useState([])

  function pushLog(msg) {
    setLog(l => [msg, ...l].slice(0, 5))
  }

  return (
    <Section
      title="Option 1 — Segmented dropdown + button"
      description={'A deck selector and the "Add" action fused into one connected control, like a segmented button. "+ Create new deck" lives as the last item in the dropdown and opens a small modal for the name.'}
    >
      <div style={{ marginBottom: 16 }}>
        <SegmentedDeckAdd
          decks={decks}
          lastUsedDeckId={lastUsedDeckId}
          onSelectDefaultDeck={id => { setLastUsedDeckId(id); pushLog(`Default deck changed to "${decks[id]?.name}"`) }}
          onCreateDeck={name => {
            const { decks: newDecks, deckId } = createDeck(decks, name)
            setDecks(newDecks)
            setLastUsedDeckId(deckId)
            pushLog(`Created deck "${name}" and set it as default`)
          }}
          onAdd={() => pushLog(`Added word to "${decks[lastUsedDeckId]?.name}"`)}
        />
      </div>
      <ActivityLog entries={log} />
    </Section>
  )
}

function OptionTwo() {
  const [decks, setDecks] = useState(seedDecks)
  const [lastUsedDeckId, setLastUsedDeckId] = useState('immersion-words')
  const [open, setOpen] = useState(false)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [log, setLog] = useState([])

  function pushLog(msg) {
    setLog(l => [msg, ...l].slice(0, 5))
  }

  return (
    <Section
      title="Option 2 — General “Add” action opens a modal"
      description="A single Add button opens a sheet listing every deck, with an inline row to type a new deck's name and create it there. Slides up on mobile, fades + scales in on desktop."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen(true)}
          className="done-btn"
          style={{
            height: 40, padding: '0 18px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
            background: 'rgba(58,189,164,0.18)', color: ACCENT, border: '1px solid rgba(58,189,164,0.45)',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          Add to SRS
        </button>
        <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>
          → will add to &ldquo;{decks[lastUsedDeckId]?.name}&rdquo;
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_CAPTION, color: TEXT_MUTED, cursor: 'pointer' }}>
          <input type="checkbox" checked={previewMobile} onChange={() => setPreviewMobile(v => !v)} />
          Preview as mobile (bottom sheet)
        </label>
      </div>
      <ActivityLog entries={log} />

      <DeckPickerSheet
        open={open}
        decks={decks}
        lastUsedDeckId={lastUsedDeckId}
        onSelect={id => { setLastUsedDeckId(id); pushLog(`Added word to "${decks[id]?.name}"`) }}
        onCreateDeck={name => {
          const { decks: newDecks, deckId } = createDeck(decks, name)
          setDecks(newDecks)
          setLastUsedDeckId(deckId)
          pushLog(`Created deck "${name}" and added word to it`)
        }}
        onClose={() => setOpen(false)}
        isMobile={previewMobile}
        title="Add new word to which deck?"
      />
    </Section>
  )
}

function OptionThree() {
  const [decks, setDecks] = useState(seedDecks)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [log, setLog] = useState([])

  function pushLog(msg) {
    setLog(l => [msg, ...l].slice(0, 5))
  }

  return (
    <Section
      title="Option 3 — Type-to-filter-or-create combobox"
      description={'One compact control: click "Add to SRS", then either pick a deck from the live-filtered list or keep typing and press Enter/click "Create" to make a new one and add straight into it — no separate modal step, no default-deck concept. (Notion/Linear/GitHub label-picker pattern.)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <DeckComboBox
          decks={decks}
          isMobile={previewMobile}
          onAdd={id => pushLog(`Added word to "${decks[id]?.name}"`)}
          onCreateAndAdd={name => {
            const { decks: newDecks } = createDeck(decks, name)
            setDecks(newDecks)
            pushLog(`Created deck "${name}" and added word to it`)
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_CAPTION, color: TEXT_MUTED, cursor: 'pointer' }}>
          <input type="checkbox" checked={previewMobile} onChange={() => setPreviewMobile(v => !v)} />
          Preview as mobile (bottom sheet)
        </label>
      </div>
      <ActivityLog entries={log} />
    </Section>
  )
}

export default function DeckPickerLabPage() {
  return (
    <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT, overflow: 'hidden' }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Deck picker lab' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: 8 }}>
            Add-to-SRS deck picker — UX comparison
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 28, lineHeight: 1.5 }}>
            Three live, interactive candidates for choosing/creating a deck when adding a word to SRS.
            Each section below is fully isolated with its own mock decks — nothing here touches real data.
          </div>
          <OptionOne />
          <OptionTwo />
          <OptionThree />
        </div>
      </main>
    </div>
  )
}
