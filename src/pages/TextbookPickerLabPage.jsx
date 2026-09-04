import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import ChipSelector from '../components/Chip.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import TextInput from '../components/TextInput.jsx'
import Modal from '../components/Modal.jsx'
import { TextbookBrowser } from '../components/TextbookPicker.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { TEXTBOOKS } from '../data/textbooks.js'
import { MODULES } from '../data/modules.js'
import { WORD_DATA } from '../data/wordData.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_LIST_TITLE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Dev-only bench for the change-textbook surface. The shipped picker
// (components/TextbookPicker.jsx) is a plain Modal + OptionPicker: a name
// and a meta string, no cover, no description, nowhere to buy the book.
// This page puts four fuller layouts side by side against the real data so
// one can be chosen before any of it becomes production. Not linked from the
// dashboard; same convention as ToastLabPage/HomeCardsLabPage.

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const ACCENT = MODULES.find(m => m.id === 'school-vocab').accent

const WORD_COUNTS = WORD_DATA.reduce((map, w) => {
  if (!w.isSentenceVocab) map[w.listKey] = (map[w.listKey] ?? 0) + 1
  return map
}, {})

const hasWords = book => book.chapters.some(ch => (WORD_COUNTS[ch.id] ?? 0) > 0)

const LAYOUTS = [
  {
    value: 'rows',
    label: 'Rows',
    blurb: 'Closest to today\'s picker: one scannable row per book, expanding in place to show description and shops. Scales past a dozen books and keeps search.',
  },
  {
    value: 'gallery',
    label: 'Gallery',
    blurb: 'Covers first, as a grid of tiles, with the selected book\'s detail below. Leans on the pixel art being the most recognisable thing about each book.',
  },
  {
    value: 'split',
    label: 'Split',
    blurb: 'Master list left, full detail right. The only layout where description and shops are visible without an extra interaction. Under 560px it stacks: detail pinned on top, list scrolling below, confirm button pinned at the bottom.',
  },
  {
    value: 'spotlight',
    label: 'Spotlight',
    blurb: 'One book at a time, stepped through with a filmstrip. Most room per book and the most deliberate feel; worst for comparing or finding a known title.',
  },
]

const WIDTHS = [
  { value: 375, label: '375 (phone)' },
  { value: 393, label: '393 (phone)' },
  { value: 420, label: '420 (md)' },
  { value: 560, label: '560 (lg)' },
  { value: 640, label: '640 (xl)' },
  { value: 760, label: '760' },
]

export default function TextbookPickerLabPage() {
  const [layout, setLayout] = useState('rows')
  const [width, setWidth] = useState(560)
  const [selectedId, setSelectedId] = useState('nsm-n3')
  const [chosenId, setChosenId] = useState('nsm-n3')
  const [modalOpen, setModalOpen] = useState(false)
  const isMobile = useIsMobile()

  const active = LAYOUTS.find(l => l.value === layout)
  const body = (
    <PickerBody
      layout={layout}
      currentId={chosenId}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onChoose={id => { setChosenId(id); setModalOpen(false) }}
      width={width}
    />
  )

  return (
    <ModuleThemeProvider accent={ACCENT}>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
      }}>
        <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Textbook picker' }]} />

        <main style={{ flex: 1, overflowY: 'auto', padding: SPACE_24 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Change textbook — layout options</div>
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5 }}>
              Four ways to show cover, name, description and where to buy. Real textbook data, real
              components. The preview below is a mock of the Modal panel so the layouts can be compared
              without opening anything; &ldquo;Open as modal&rdquo; mounts the real one.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE_16, margin: `${SPACE_24}px 0 ${SPACE_8}px` }}>
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Layout</span>
              <ChipSelector mode="single" options={LAYOUTS} value={layout} onChange={setLayout} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE_16, marginBottom: SPACE_16 }}>
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Panel width</span>
              <ChipSelector mode="single" options={WIDTHS} value={width} onChange={setWidth} />
              <Button variant="neutral" size="sm" onClick={() => setModalOpen(true)}>Open as modal</Button>
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 'auto' }}>
                In use: {TEXTBOOKS.find(b => b.id === chosenId)?.title ?? 'none'}
              </span>
            </div>

            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_24 }}>
              {active.blurb}
            </div>

            <SectionLabel label="Preview" />
            <MockPanel width={width}>{body}</MockPanel>

            <div style={{ marginTop: SPACE_32 }}>
              <SectionLabel label="Trade-offs" />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: SPACE_16 }}>
                {LAYOUTS.map(l => (
                  <div key={l.value} style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: SPACE_16 }}>
                    <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: SPACE_4 }}>{l.label}</div>
                    <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5 }}>{l.blurb}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Change textbook"
          size={width <= 420 ? 'md' : width <= 560 ? 'lg' : 'xl'}
          isMobile={isMobile}
          bodyPadding={0}
        >
          {body}
        </Modal>
      </div>
    </ModuleThemeProvider>
  )
}

// Mimics Modal's panel chrome so a layout can be judged in situ without the
// scrim swallowing the page every time the width changes.
function MockPanel({ width, children }) {
  return (
    <div style={{
      width, maxWidth: '100%',
      background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${SPACE_12}px ${SPACE_16}px`, borderBottom: `1px solid ${HAIRLINE}`,
      }}>
        <span style={{ fontSize: FS_BASE, color: TEXT }}>Change textbook</span>
        <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Close</span>
      </div>
      {children}
    </div>
  )
}

function PickerBody(props) {
  if (props.layout === 'gallery') return <GalleryLayout {...props} />
  // The real component, so the bench can't drift from what ships.
  if (props.layout === 'split') return (
    <TextbookBrowser
      currentId={props.currentId}
      onChoose={props.onChoose}
      wordCountFor={id => WORD_COUNTS[id] ?? 0}
      stacked={props.width < 560}
    />
  )
  if (props.layout === 'spotlight') return <SpotlightLayout {...props} />
  return <RowsLayout {...props} />
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function Cover({ book, size }) {
  if (!book.icon) {
    return (
      <div style={{
        width: size, height: size, flexShrink: 0, borderRadius: 4,
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${HAIRLINE}`, borderLeft: `6px solid ${ACCENT}`,
      }} />
    )
  }
  return <img src={book.icon} alt="" style={{ width: size, height: size, flexShrink: 0, imageRendering: 'pixelated' }} />
}

function Meta({ book }) {
  return (
    <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>
      {book.chapters.length} chapters · {book.publisher}
      {!hasWords(book) && ' · no words yet'}
    </span>
  )
}

function BuyLinks({ book, align = 'left' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_12, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Buy:</span>
      {book.purchase.map(link => (
        <a
          key={link.label}
          className="tb-buy"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: FS_CAPTION, color: ACCENT, textDecoration: 'none' }}
        >
          {link.label} ↗
        </a>
      ))}
    </div>
  )
}

function Description({ book, style }) {
  return (
    <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5, ...style }}>
      {book.description}
    </div>
  )
}

function CurrentBadge() {
  return <Badge tone="accent">Current</Badge>
}

function useSearch(books) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? books.filter(b => `${b.title} ${b.publisher} ${b.subtitle}`.toLowerCase().includes(trimmed))
    : books
  return { query, setQuery, filtered }
}

function SearchRow({ query, setQuery }) {
  return (
    <div style={{ padding: SPACE_12, borderBottom: `1px solid ${HAIRLINE}` }}>
      <TextInput value={query} onChange={setQuery} placeholder="Search textbooks…" fullWidth />
    </div>
  )
}

// ── A. Rows ───────────────────────────────────────────────────────────────────

function RowsLayout({ currentId, selectedId, onSelect, onChoose }) {
  const { query, setQuery, filtered } = useSearch(TEXTBOOKS)
  return (
    <div>
      <SearchRow query={query} setQuery={setQuery} />
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {filtered.map(book => {
          const open = book.id === selectedId
          return (
            <div key={book.id} className="tb-row" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <button
                type="button"
                onClick={() => onSelect(open ? null : book.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: SPACE_12, width: '100%',
                  padding: SPACE_12, background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: FONT, letterSpacing: TRACKING, textAlign: 'left', color: TEXT,
                }}
              >
                <Cover book={book} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: SPACE_8 }}>
                    <span style={{ fontSize: FS_BASE }}>{book.title}</span>
                    {book.id === currentId && <CurrentBadge />}
                  </span>
                  <span style={{ display: 'block', marginTop: 2 }}><Meta book={book} /></span>
                </span>
                <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div style={{ padding: `0 ${SPACE_12}px ${SPACE_12}px 68px`, display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
                  <Description book={book} />
                  <BuyLinks book={book} />
                  <div>
                    <Button size="sm" disabled={book.id === currentId} onClick={() => onChoose(book.id)}>
                      {book.id === currentId ? 'In use' : 'Use this textbook'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── B. Gallery ────────────────────────────────────────────────────────────────

function GalleryLayout({ currentId, selectedId, onSelect, onChoose, width }) {
  const selected = TEXTBOOKS.find(b => b.id === selectedId) ?? TEXTBOOKS[0]
  const columns = width >= 640 ? 4 : width >= 560 ? 3 : 2
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: SPACE_12, padding: SPACE_16, maxHeight: 320, overflowY: 'auto',
      }}>
        {TEXTBOOKS.map(book => {
          const isSelected = book.id === selected.id
          return (
            <button
              key={book.id}
              type="button"
              className="tb-tile"
              onClick={() => onSelect(book.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_8,
                padding: SPACE_12, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${isSelected ? ACCENT : HAIRLINE}`,
                background: isSelected ? `${ACCENT}1f` : 'transparent',
                fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
              }}
            >
              <Cover book={book} size={72} />
              <span style={{ fontSize: FS_CAPTION, textAlign: 'center', lineHeight: 1.3 }}>{book.title}</span>
              {book.id === currentId && <CurrentBadge />}
            </button>
          )
        })}
      </div>

      <div style={{ borderTop: `1px solid ${HAIRLINE}`, padding: SPACE_16, display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
        <div>
          <div style={{ fontSize: FS_LIST_TITLE, color: TEXT }}>{selected.title}</div>
          <Meta book={selected} />
        </div>
        <Description book={selected} />
        <BuyLinks book={selected} />
        <div>
          <Button disabled={selected.id === currentId} onClick={() => onChoose(selected.id)}>
            {selected.id === currentId ? 'In use' : 'Use this textbook'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── D. Spotlight ──────────────────────────────────────────────────────────────

function SpotlightLayout({ currentId, selectedId, onSelect, onChoose }) {
  const index = Math.max(0, TEXTBOOKS.findIndex(b => b.id === selectedId))
  const book = TEXTBOOKS[index]
  const step = delta => onSelect(TEXTBOOKS[(index + delta + TEXTBOOKS.length) % TEXTBOOKS.length].id)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_12, padding: SPACE_16 }}>
        <Button variant="ghost-muted" size="sm" onClick={() => step(-1)} label="Previous">‹</Button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_12, textAlign: 'center' }}>
          <Cover book={book} size={128} />
          <div>
            <div style={{ fontSize: FS_LIST_TITLE, color: TEXT }}>{book.title}</div>
            <div style={{ marginTop: SPACE_4 }}><Meta book={book} /></div>
          </div>
          <Description book={book} style={{ textAlign: 'center', maxWidth: 420 }} />
          <BuyLinks book={book} align="center" />
          <Button disabled={book.id === currentId} onClick={() => onChoose(book.id)}>
            {book.id === currentId ? 'In use' : 'Use this textbook'}
          </Button>
        </div>
        <Button variant="ghost-muted" size="sm" onClick={() => step(1)} label="Next">›</Button>
      </div>

      <div style={{
        display: 'flex', gap: SPACE_8, justifyContent: 'center', flexWrap: 'wrap',
        padding: SPACE_12, borderTop: `1px solid ${HAIRLINE}`,
      }}>
        {TEXTBOOKS.map(b => (
          <button
            key={b.id}
            type="button"
            className="tb-tile"
            onClick={() => onSelect(b.id)}
            aria-label={b.title}
            style={{
              padding: 2, borderRadius: 4, cursor: 'pointer', background: 'none',
              border: `1px solid ${b.id === book.id ? ACCENT : 'transparent'}`,
              opacity: b.id === book.id ? 1 : 0.55,
            }}
          >
            <Cover book={b} size={32} />
          </button>
        ))}
      </div>
    </div>
  )
}
