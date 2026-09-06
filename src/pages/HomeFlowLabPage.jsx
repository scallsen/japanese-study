import { useState, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import ChipSelector from '../components/Chip.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import Card from '../components/Card.jsx'
import DataList from '../components/DataList.jsx'
import Modal from '../components/Modal.jsx'
import Popover from '../components/Popover.jsx'
import OptionPicker from '../components/OptionPicker.jsx'
import Menu from '../components/Menu.jsx'
import ToggleButton from '../components/ToggleButton.jsx'
import Switch from '../components/Switch.jsx'
import NumberField from '../components/NumberField.jsx'
import Select from '../components/Select.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import Notice from '../components/Notice.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Disclosure from '../components/Disclosure.jsx'
import { PrimaryCard } from './homeCards.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { resolveTextbookState } from '../lib/textbookProgress.js'
import { TEXTBOOKS, getTextbook } from '../data/textbooks.js'
import { MODULES } from '../data/modules.js'
import { WORD_DATA } from '../data/wordData.js'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_DISPLAY_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Dev-only bench for the shape of the whole learn → remember loop: where
// textbook progress is managed, where a one-off "free" drill starts, what
// the SRS index page is for once the home card owns "Start reviews", and
// what happens at the end of a lesson. Three concepts, each a click-through
// mock over the same fabricated state, so switching concept mid-flow shows
// the same situation handled three ways. Real components, fake data — the
// HomeCardsLabPage / TextbookPickerLabPage convention. Not linked from the
// dashboard; reached at #/dev/home-flow. Written up in
// docs/home-flow-concepts.md.

const BG = '#1E1E1E'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const VOCAB_ACCENT = MODULES.find(m => m.id === 'school-vocab').accent
const SRS_ACCENT = MODULES.find(m => m.id === 'vocab-srs').accent

const BOOK_ID = 'genki-1'
const DAILY_NEW = 10

const WORD_COUNT_BY_LIST = WORD_DATA.reduce((map, w) => {
  if (!w.isSentenceVocab) map[w.listKey] = (map[w.listKey] ?? 0) + 1
  return map
}, {})
const wordCountFor = id => WORD_COUNT_BY_LIST[id] ?? 0
const BOOKS_WITH_WORDS = TEXTBOOKS.filter(b => !b.personal && b.chapters.some(ch => wordCountFor(ch.id) > 0))

const CONCEPTS = [
  {
    value: 'console',
    label: 'A · Home is the console',
    blurb: 'The textbook card manages progress by itself: a current-chapter control on the card, one primary button that always reads "Start <current>", and the pointer advances when a lesson is finished from it. A free drill is a sheet opened from the card, not a page. The Vocab index and the SRS home are both deleted; SRS management collapses into one Decks page.',
    deletes: ['#/vocab home screen (source dropdown + tiles)', '#/vocab-srs home (summary + Start + imports)'],
    adds: ['Current-chapter popover on the home card', '"Drill any list" sheet', '#/decks page (deck list, imports, review settings)'],
  },
  {
    value: 'pages',
    label: 'B · Two focused pages',
    blurb: 'Home cards stay launchers. Each index is rebuilt around its real job: the Vocab page becomes the textbook\'s chapter path (drill, preview, send to SRS, set as current, per chapter) with other lists folded underneath for free drilling; the SRS page becomes a deck list front and centre, with the queue summary demoted above it.',
    deletes: ['Nothing — both routes stay, both screens change'],
    adds: ['Textbook page (chapter path with per-row actions)', 'Decks page in place of the SRS home; deck rows leave the sidebar'],
  },
  {
    value: 'hub',
    label: 'C · One vocabulary hub',
    blurb: 'A chapter list and an SRS deck are the same kind of thing: a set of words. One page with two tabs — Learn (chapters, any book) and Remember (decks) — replaces both indexes. Sending a chapter to the SRS lands in a deck named after the book, so the Remember tab mirrors the Learn tab.',
    deletes: ['#/vocab home screen', '#/vocab-srs home', 'SRS module identity — it becomes a tab'],
    adds: ['#/vocabulary hub with Learn / Remember tabs'],
  },
]

const DRILL_MODE_OPTIONS = [
  { value: 'kanji-front', label: 'Japanese → English' },
  { value: 'meaning-front', label: 'English → Japanese' },
]

const INITIAL_DECKS = [
  { id: 'genki-1', name: 'Genki 1', source: 'imported', active: true, due: 12, newAvailable: 40, dist: { new: 40, learning: 31, young: 60, mature: 25, relearning: 0 } },
  { id: 'core2000', name: 'Core 2000', source: 'bundled', active: true, due: 9, newAvailable: 1500, dist: { new: 1500, learning: 80, young: 220, mature: 207, relearning: 0 } },
  { id: 'immersion-words', name: 'Immersion words', source: 'imported', active: false, due: 4, newAvailable: 10, dist: { new: 10, learning: 12, young: 15, mature: 5, relearning: 0 } },
  { id: 'story-words', name: 'Story words', source: 'imported', active: true, due: 0, newAvailable: 18, dist: { new: 18, learning: 0, young: 0, mature: 0, relearning: 0 } },
]

function initialProgress() {
  const book = getTextbook(BOOK_ID)
  const sublists = {}
  for (const ch of book.chapters.slice(0, 3)) {
    sublists[ch.id] = { 'kanji-front': { lastReviewed: '2026-09-03T00:00:00Z', correct: 40, total: 48 } }
  }
  return { textbook: { id: BOOK_ID, currentChapterId: book.chapters[3].id }, sublists }
}

const deckTotal = d => Object.values(d.dist).reduce((a, b) => a + b, 0)

function summariseDecks(decks) {
  const active = decks.filter(d => d.active)
  const due = active.reduce((s, d) => s + d.due, 0)
  const newAvailable = active.reduce((s, d) => s + d.newAvailable, 0)
  const newToday = Math.min(DAILY_NEW, newAvailable)
  return {
    due,
    newToday,
    newWaiting: newAvailable - newToday,
    totalCards: decks.reduce((s, d) => s + deckTotal(d), 0),
    activeDecks: active.length,
    canStart: due + newToday > 0,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomeFlowLabPage() {
  const isMobile = useIsMobile()
  const [concept, setConcept] = useState('console')
  const [progress, setProgress] = useState(initialProgress)
  const [decks, setDecks] = useState(INITIAL_DECKS)
  const [sent, setSent] = useState(() => new Set(getTextbook(BOOK_ID).chapters.slice(0, 3).map(ch => ch.id)))
  const [screen, setScreen] = useState({ name: 'home' })
  const [log, setLog] = useState([])

  const state = resolveTextbookState(progress, wordCountFor)
  const srs = summariseDecks(decks)
  const note = msg => setLog(l => [msg, ...l].slice(0, 6))

  // A drill started from the card's primary button carries the pointer with
  // it; a drill started anywhere else is a free drill and leaves it alone.
  function startDrill(chapter, { advance, bookId = BOOK_ID } = {}) {
    setScreen({ name: 'drill', chapter, advance, bookId })
    note(`Drill ${chapter.label}${advance ? '' : ' (free drill — pointer untouched)'}`)
  }

  function finishDrill() {
    const { chapter, advance, bookId } = screen
    if (bookId === BOOK_ID) {
      setProgress(p => {
        const sublists = { ...p.sublists, [chapter.id]: { 'kanji-front': { lastReviewed: new Date().toISOString(), correct: 40, total: chapter.wordCount ?? 48 } } }
        const book = getTextbook(BOOK_ID)
        const idx = book.chapters.findIndex(ch => ch.id === chapter.id)
        const nextId = advance ? (book.chapters[idx + 1]?.id ?? chapter.id) : p.textbook.currentChapterId
        return { ...p, sublists, textbook: { ...p.textbook, currentChapterId: nextId } }
      })
    }
    setScreen({ name: 'done', chapter, bookId, advance, alreadySent: sent.has(chapter.id) })
  }

  function sendToSrs(chapter, bookId = BOOK_ID) {
    const book = getTextbook(bookId)
    const count = wordCountFor(chapter.id)
    setDecks(ds => {
      const existing = ds.find(d => d.id === book.id)
      if (existing) return ds.map(d => d.id === book.id ? { ...d, newAvailable: d.newAvailable + count, dist: { ...d.dist, new: d.dist.new + count } } : d)
      return [...ds, { id: book.id, name: book.title, source: 'imported', active: true, due: 0, newAvailable: count, dist: { new: count, learning: 0, young: 0, mature: 0, relearning: 0 } }]
    })
    setSent(s => new Set([...s, chapter.id]))
    note(`Sent ${count} words from ${chapter.label} to the "${book.title}" deck`)
  }

  function setPointer(chapterId) {
    setProgress(p => ({ ...p, textbook: { ...p.textbook, currentChapterId: chapterId } }))
    const label = state.chapters.find(ch => ch.id === chapterId)?.label
    note(`Current chapter set to ${label}`)
  }

  function toggleDeck(id) {
    setDecks(ds => ds.map(d => d.id === id ? { ...d, active: !d.active } : d))
  }

  function reset() {
    setProgress(initialProgress())
    setDecks(INITIAL_DECKS)
    setSent(new Set(getTextbook(BOOK_ID).chapters.slice(0, 3).map(ch => ch.id)))
    setScreen({ name: 'home' })
    setLog([])
  }

  const active = CONCEPTS.find(c => c.value === concept)
  const go = name => setScreen({ name })
  const mock = { state, srs, decks, sent, screen, concept, isMobile, go, startDrill, finishDrill, sendToSrs, setPointer, toggleDeck, note }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Home flow' }]} />

      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? SPACE_16 : SPACE_24 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Learn → remember: three shapes for the loop</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 820, lineHeight: 1.5 }}>
            The same fabricated learner — Genki 1, three lessons drilled and sent, four SRS decks — under each
            concept. Every button in the frame below does something to that state, so a full lap (start the
            current lesson, finish it, answer the send-to-SRS prompt, look at the decks) can be walked in each
            concept and compared. The home cards are real <code>PrimaryCard</code>s; pages are mocks.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE_12, margin: `${SPACE_24}px 0 ${SPACE_12}px` }}>
            <ChipSelector mode="single" size="md" options={CONCEPTS} value={concept} onChange={v => { setConcept(v); setScreen({ name: 'home' }) }} />
            <div style={{ marginLeft: 'auto' }}><Button variant="ghost-muted" size="sm" onClick={reset}>Reset state</Button></div>
          </div>

          <ConceptSummary concept={active} />

          <Frame mock={mock} />

          <div style={{ marginTop: SPACE_16, fontSize: FS_CAPTION, color: TEXT_MUTED }}>
            {log.length === 0 ? 'No actions yet.' : log.map((l, i) => <div key={i} style={{ opacity: i === 0 ? 1 : 0.6 }}>{l}</div>)}
          </div>

          <SharedRules />
        </div>
      </main>
    </div>
  )
}

function ConceptSummary({ concept }) {
  return (
    <Card padding={SPACE_16} style={{ marginBottom: SPACE_16 }}>
      <div style={{ fontSize: FS_BASE, lineHeight: 1.5, maxWidth: 820 }}>{concept.blurb}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: SPACE_16, marginTop: SPACE_12 }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_4 }}>Deletes</div>
          {concept.deletes.map(d => <div key={d} style={{ fontSize: FS_BASE }}>· {d}</div>)}
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_4 }}>Adds</div>
          {concept.adds.map(d => <div key={d} style={{ fontSize: FS_BASE }}>· {d}</div>)}
        </div>
      </div>
    </Card>
  )
}

function SharedRules() {
  const rules = [
    ['One pointer, one rule', 'The current chapter is the only progress state. A drill started from the home card\'s primary button advances it on completion; a drill started from anywhere else is a free drill and never touches it. "Free drill" is therefore not a mode — it is every drill that is not the current lesson.'],
    ['Every drill ends the same way', 'The done screen is shared. Its send-to-SRS prompt defaults to a deck named after the book (created on first send), with the deck picker there for overriding. Skipping asks once. A chapter already in the SRS gets no prompt.'],
    ['All decks on by default', 'The home card\'s "Start reviews" runs the queue across every active deck; the deck list is where a deck is switched off, browsed, renamed or deleted. Card-display settings stay in the review drill\'s own sidebar; queue settings (daily new, leech) sit with the decks because they change what the home card promises.'],
    ['Other modules feed the same place', 'Immersion, Story, Anime Vocab and the dictionary keep adding to their own imported decks; they show up in the deck list like any other deck.'],
  ]
  return (
    <div style={{ marginTop: SPACE_32 }}>
      <SectionHeader title="Rules shared by all three" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: SPACE_12 }}>
        {rules.map(([title, body]) => (
          <Card key={title} padding={SPACE_16}>
            <div style={{ fontSize: FS_BASE, marginBottom: SPACE_4 }}>{title}</div>
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>{body}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── The mock app frame ────────────────────────────────────────────────────────

const SCREEN_CRUMB = {
  drill: 'Reviewing',
  done: 'Session complete',
  decks: 'Decks',
  browse: 'Browse cards',
  textbook: 'Vocabulary Training',
  hub: 'Vocabulary',
}

function Frame({ mock }) {
  const { screen, concept, go } = mock
  const crumbs = [{ label: 'Japanese Study', onClick: () => go('home') }]
  if (screen.name !== 'home') {
    if (screen.name === 'browse') crumbs.push({ label: 'Decks', onClick: () => go('decks') })
    if (screen.name === 'drill' || screen.name === 'done') {
      crumbs.push({ label: concept === 'hub' ? 'Vocabulary' : 'Vocabulary Training', onClick: () => go('home') })
    }
    crumbs.push({ label: SCREEN_CRUMB[screen.name] ?? screen.name })
  }

  return (
    <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: 'hidden', background: BG }}>
      <PageHeader crumbs={crumbs} />
      <div style={{ padding: mock.isMobile ? SPACE_16 : SPACE_24, minHeight: 420 }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {screen.name === 'home' && <HomeScreen mock={mock} />}
          {screen.name === 'drill' && <DrillScreen mock={mock} />}
          {screen.name === 'done' && <DoneScreen mock={mock} />}
          {screen.name === 'decks' && <DecksScreen mock={mock} />}
          {screen.name === 'browse' && <BrowsePlaceholder mock={mock} />}
          {screen.name === 'textbook' && <TextbookScreen mock={mock} />}
          {screen.name === 'hub' && <HubScreen mock={mock} />}
        </div>
      </div>
    </div>
  )
}

// ── Home (per concept) ────────────────────────────────────────────────────────

function HomeScreen({ mock }) {
  const { concept, isMobile } = mock
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
      gap: SPACE_12,
    }}>
      {concept === 'console' ? <ConsoleNewCard mock={mock} /> : <LauncherNewCard mock={mock} />}
      <MockReviewCard mock={mock} />
    </div>
  )
}

function Cover({ icon }) {
  return <img src={icon} alt="" style={{ width: 104, height: 104, imageRendering: 'pixelated', flexShrink: 0 }} />
}

function CardLinks({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_4, marginLeft: -14 }}>{children}</div>
}

function CardActions({ links, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
      {links && <CardLinks>{links}</CardLinks>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8 }}>{children}</div>
    </div>
  )
}

// Concept A. The card is the chapters page: the pointer is a control on the
// card, the primary button is always exactly one button, and a free drill is
// a sheet.
function ConsoleNewCard({ mock }) {
  const { state, sent, startDrill, setPointer, isMobile } = mock
  const { textbook, chapters, current, doneCount, wordsDrilled } = state
  const complete = doneCount === chapters.length
  const [pickerOpen, setPickerOpen] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const anchorRef = useRef(null)

  const items = chapters.map(ch => ({
    id: ch.id,
    label: ch.label,
    meta: ch.id === current.id ? 'Current' : ch.drilled ? (sent.has(ch.id) ? 'Done · in SRS' : 'Done') : `${ch.wordCount} words`,
  }))

  return (
    <>
      <PrimaryCard
        accent={VOCAB_ACCENT}
        title={textbook.title}
        subtitle={`${doneCount} of ${chapters.length} chapters · ${wordsDrilled} words drilled`}
        cover={<Cover icon={textbook.icon} />}
        progress={chapters.length ? doneCount / chapters.length : 0}
        actions={
          <CardActions links={<Button variant="ghost" size="sm" onClick={() => setFreeOpen(true)}>Drill any list</Button>}>
            {complete
              ? <Button size="lg" onClick={() => mock.note('Open textbook picker')}>Pick new textbook</Button>
              : <Button size="lg" onClick={() => startDrill(current, { advance: true })}>{current.drilled ? 'Redo' : 'Start'} {current.label}</Button>}
          </CardActions>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_12, fontSize: FS_BASE }}>
          <span style={{ color: TEXT_MUTED }}>Current</span>
          <Button ref={anchorRef} variant="neutral" size="sm" onClick={() => setPickerOpen(o => !o)}>
            {current.label} ▾
          </Button>
          {current.drilled && <Badge tone="neutral">drilled</Badge>}
          {sent.has(current.id) && <Badge tone="success">in SRS</Badge>}
        </div>
      </PrimaryCard>

      <ModuleThemeProvider accent={VOCAB_ACCENT}>
        <Popover open={pickerOpen} onClose={() => setPickerOpen(false)} anchorRef={anchorRef} isMobile={isMobile} title="Current chapter" width={300}>
          <OptionPicker
            items={items}
            placeholder="Jump to…"
            onSelect={id => { setPointer(id); setPickerOpen(false) }}
          />
        </Popover>
        <FreeDrillSheet open={freeOpen} onClose={() => setFreeOpen(false)} mock={mock} />
      </ModuleThemeProvider>
    </>
  )
}

// Concepts B and C. The card launches and reports; management is on a page.
// The review log's open call on the two-button row is taken here as "one
// primary, Redo as a quiet link", so both cards' primaries always align.
function LauncherNewCard({ mock }) {
  const { state, concept, startDrill, go } = mock
  const { textbook, chapters, current, next, doneCount } = state
  const complete = doneCount === chapters.length
  const target = current.drilled && next ? next : current
  const manageLabel = concept === 'hub' ? 'All chapters' : 'View all chapters'
  const manageScreen = concept === 'hub' ? 'hub' : 'textbook'

  return (
    <PrimaryCard
      accent={VOCAB_ACCENT}
      title={textbook.title}
      subtitle={complete ? 'Book completed' : `${doneCount} of ${chapters.length} chapters`}
      cover={<Cover icon={textbook.icon} />}
      progress={chapters.length ? doneCount / chapters.length : 0}
      actions={
        <CardActions links={
          <>
            <Button variant="ghost" size="sm" onClick={() => go(manageScreen)}>{manageLabel}</Button>
            {current.drilled && next && (
              <Button variant="ghost" size="sm" onClick={() => startDrill(current, { advance: false })}>Redo {current.label}</Button>
            )}
          </>
        }>
          {complete
            ? <Button size="lg" onClick={() => mock.note('Open textbook picker')}>Pick new textbook</Button>
            : <Button size="lg" onClick={() => startDrill(target, { advance: true })}>Start {target.label}</Button>}
        </CardActions>
      }
    />
  )
}

function MockReviewCard({ mock }) {
  const { srs, concept, go, note } = mock
  const { due, newToday, newWaiting, totalCards, activeDecks, canStart } = srs
  const caption = [
    `${activeDecks} active ${activeDecks === 1 ? 'deck' : 'decks'}`,
    `${totalCards} cards`,
    newWaiting > 0 ? `${newWaiting} new waiting` : null,
  ].filter(Boolean).join(' · ')
  const manageScreen = concept === 'hub' ? 'hub' : 'decks'

  return (
    <PrimaryCard
      accent={SRS_ACCENT}
      title="Reviews"
      subtitle={caption}
      actions={
        <CardActions links={<Button variant="ghost" size="sm" onClick={() => go(manageScreen)}>Decks</Button>}>
          <Button size="lg" disabled={!canStart} onClick={() => note('Start the SRS review (unchanged drill)')}>
            {canStart ? 'Start reviews' : 'Nothing due'}
          </Button>
        </CardActions>
      }
    >
      <div style={{ display: 'flex', gap: SPACE_24 }}>
        <Stat value={due} label="Due" />
        <Stat value={newToday} label="New today" />
      </div>
    </PrimaryCard>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: FS_STAT_VALUE, color: TEXT, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_4 }}>{label}</div>
    </div>
  )
}

// ── Free drill (concept A's sheet; also the "Other lists" body in B and C) ───

function FreeDrillPicker({ mock, onStart, compact = false }) {
  const [bookId, setBookId] = useState(BOOK_ID)
  const [selected, setSelected] = useState(() => new Set())
  const [mode, setMode] = useState('kanji-front')
  const book = getTextbook(bookId)
  const options = book.chapters.map(ch => ({ value: ch.id, label: `${ch.label} · ${wordCountFor(ch.id)}` }))
  const total = [...selected].reduce((s, id) => s + wordCountFor(id), 0)

  function start() {
    const first = book.chapters.find(ch => selected.has(ch.id))
    onStart({ ...first, wordCount: total, label: selected.size > 1 ? `${selected.size} lists from ${book.title}` : first.label }, bookId)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: SPACE_12 }}>
        <Select
          label="Book"
          size="md"
          value={bookId}
          onChange={v => { setBookId(v); setSelected(new Set()) }}
          options={BOOKS_WITH_WORDS.map(b => ({ value: b.id, label: b.title }))}
        />
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_4 }}>Drill mode</div>
          <ChipSelector mode="single" size="md" grow options={DRILL_MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Lists — pick any number</div>
        <ChipSelector mode="multi" options={options} value={selected} onChange={setSelected} />
      </div>
      <div style={{ display: 'flex', gap: SPACE_8, justifyContent: 'flex-end' }}>
        <Button variant="neutral" disabled={selected.size === 0} onClick={() => mock.note('Preview (existing glance screen)')}>Preview</Button>
        <Button disabled={selected.size === 0} onClick={start}>Start{total ? ` (${total} words)` : ''}</Button>
      </div>
    </div>
  )
}

function FreeDrillSheet({ open, onClose, mock }) {
  return (
    <Modal open={open} onClose={onClose} title="Drill any list" size="xl" isMobile={mock.isMobile}>
      <FreeDrillPicker
        mock={mock}
        compact={mock.isMobile}
        onStart={(chapter, bookId) => { onClose(); mock.startDrill(chapter, { advance: false, bookId }) }}
      />
    </Modal>
  )
}

// ── Drill + done (shared) ─────────────────────────────────────────────────────

function DrillScreen({ mock }) {
  const { screen, finishDrill } = mock
  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_16, padding: `${SPACE_32}px 0` }}>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>The drill itself is unchanged in every concept</div>
        <Card padding={SPACE_24} style={{ width: 'min(380px, 100%)', textAlign: 'center' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING }}>{screen.chapter.label}</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{screen.chapter.wordCount ?? wordCountFor(screen.chapter.id)} words · flip, judge, repeat</div>
        </Card>
        <Button size="lg" onClick={finishDrill}>Finish session</Button>
      </div>
    </ModuleThemeProvider>
  )
}

function DoneScreen({ mock }) {
  const { screen, state, decks, sendToSrs, startDrill, go, concept, note } = mock
  const { chapter, bookId, alreadySent } = screen
  const book = getTextbook(bookId)
  const count = chapter.wordCount ?? wordCountFor(chapter.id)
  const bookDeck = decks.find(d => d.id === book.id)
  const [deckId, setDeckId] = useState(bookDeck ? bookDeck.id : `new:${book.id}`)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [done, setDone] = useState(alreadySent)

  const deckOptions = [
    ...(bookDeck ? [] : [{ value: `new:${book.id}`, label: `${book.title} (new deck)` }]),
    ...decks.filter(d => d.source !== 'bundled').map(d => ({ value: d.id, label: d.name })),
  ]

  function send() {
    sendToSrs(chapter, bookId)
    if (!deckId.startsWith('new:') && deckId !== book.id) note(`(mock only routes to the book deck — chosen "${deckId}")`)
    setDone(true)
  }

  const nextLabel = state.current && !state.current.drilled ? `Start ${state.current.label}` : null

  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: FS_DISPLAY_HEADING }}>Session complete</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{chapter.label} · {count} words</div>
        </div>
        <div style={{ display: 'flex', gap: SPACE_32 }}>
          <Stat value={count - 6} label="Correct" />
          <Stat value={6} label="Troubled" />
        </div>

        <Card padding={SPACE_16} style={{ width: 'min(520px, 100%)' }}>
          <SectionHeader title="Remember these words" />
          {done ? (
            <Notice tone="success" title={alreadySent ? 'Already in your SRS' : `Sent to "${book.title}"`}>
              {alreadySent ? 'This chapter was sent before, so there is nothing to prompt.' : 'They will show up as new cards in the review queue from today.'}
            </Notice>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>
                Send all {count} words to a deck so the review queue keeps them alive. The book&apos;s own deck is the default; the troubled six are ticked in the list below either way.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>
                <Select size="md" value={deckId} onChange={setDeckId} options={deckOptions} />
                <Button onClick={send}>Send {count} to SRS</Button>
                <Button variant="ghost-muted" size="sm" onClick={() => setConfirmSkip(true)}>Not now</Button>
              </div>
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, justifyContent: 'center' }}>
          {nextLabel && screen.advance !== false && (
            <Button size="lg" onClick={() => startDrill(state.current, { advance: true })}>{nextLabel}</Button>
          )}
          <Button variant="neutral" size="lg" onClick={() => startDrill(chapter, { advance: false, bookId })}>Redo troubled</Button>
          <Button variant="neutral" size="lg" onClick={() => go(concept === 'hub' ? 'hub' : 'home')}>{concept === 'hub' ? 'Vocabulary' : 'Home'}</Button>
        </div>

        <ConfirmDialog
          open={confirmSkip}
          title="Skip sending to the SRS?"
          message={`These ${count} words won't be reviewed until you send them. You can do it later from the chapter list.`}
          confirmLabel="Skip for now"
          danger={false}
          onConfirm={() => { setConfirmSkip(false); setDone(true); note(`Skipped sending ${chapter.label}`) }}
          onCancel={() => setConfirmSkip(false)}
        />
      </div>
    </ModuleThemeProvider>
  )
}

// ── Decks (A and B's SRS page; C's Remember tab) ──────────────────────────────

function DeckList({ mock, mirror = false }) {
  const { decks, toggleDeck, go, state, sent } = mock
  const columns = [
    {
      key: 'name',
      flex: 2,
      render: d => {
        const total = deckTotal(d)
        const sentCount = mirror && d.id === state.textbook.id ? state.chapters.filter(ch => sent.has(ch.id)).length : null
        return (
          <div>
            <div style={{ fontSize: FS_BASE, color: d.active ? TEXT : TEXT_MUTED }}>{d.name}</div>
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>
              {sentCount != null
                ? `${total} cards · ${sentCount} of ${state.chapters.length} chapters sent`
                : `${total} cards · ${d.due} due · ${d.newAvailable} new`}
            </div>
          </div>
        )
      },
    },
    {
      key: 'dist',
      flex: 1.4,
      // The cell is a flex row, so the bar needs an explicit width to fill it.
      render: d => <div style={{ width: '100%' }}><DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: d.dist[s.key] ?? 0 }))} showLegend={false} /></div>,
    },
    {
      key: 'toggle',
      width: 64,
      align: 'right',
      render: d => (
        <span onClick={e => e.stopPropagation()}>
          <ToggleButton active={d.active} labels={{ on: 'On', off: 'Off' }} onClick={() => toggleDeck(d.id)} />
        </span>
      ),
    },
  ]
  return (
    <DataList
      columns={columns}
      rows={decks}
      maxWidth={820}
      navigate={{ onClick: () => go('browse') }}
    />
  )
}

function ImportButton({ mock }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <Button ref={ref} variant="neutral" size="sm" onClick={() => setOpen(o => !o)}>Import ▾</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} isMobile={mock.isMobile} align="end" width={220}>
        <Menu
          items={[{ id: 'anki', label: 'Anki export (.txt)' }, { id: 'text', label: 'From text or image' }]}
          onSelect={id => { setOpen(false); mock.note(`Import: ${id} (existing flow)`) }}
        />
      </Popover>
    </>
  )
}

function ReviewSettings() {
  const [daily, setDaily] = useState(DAILY_NEW)
  const [leech, setLeech] = useState(8)
  const [hardEasy, setHardEasy] = useState(true)
  const row = (label, control, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE_12, padding: `${SPACE_8}px 0` }}>
      <div>
        <div style={{ fontSize: FS_BASE }}>{label}</div>
        {sub && <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{sub}</div>}
      </div>
      {control}
    </div>
  )
  return (
    <Card padding={`${SPACE_4}px ${SPACE_16}px`} style={{ maxWidth: 820 }}>
      {row('Daily new cards', <NumberField value={daily} onChange={setDaily} min={1} />, 'Changes what the home card promises')}
      {row('Leech threshold', <NumberField value={leech} onChange={setLeech} min={0} />, 'lapses (0 = off)')}
      {row('Show Hard / Easy buttons', <Switch checked={hardEasy} onChange={setHardEasy} />)}
    </Card>
  )
}

function DecksScreen({ mock }) {
  const { srs, concept, decks, note } = mock
  return (
    <ModuleThemeProvider accent={SRS_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
        {concept === 'pages' && (
          <Card padding={SPACE_16} style={{ maxWidth: 820 }}>
            <div style={{ fontSize: FS_CONTENT_HEADING }}>{srs.canStart ? `${srs.due} due · ${srs.newToday} new · ~${Math.ceil((srs.due + srs.newToday) * 0.25)} min` : 'Nothing due'}</div>
            <div style={{ margin: `${SPACE_12}px 0` }}>
              <DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: decks.filter(d => d.active).reduce((n, d) => n + (d.dist[s.key] ?? 0), 0) }))} />
            </div>
            <Button variant="accent-outline" size="lg" fullWidth disabled={!srs.canStart} onClick={() => note('Start the SRS review')}>
              {srs.canStart ? `Start review (${srs.due + srs.newToday})` : 'Nothing due'}
            </Button>
          </Card>
        )}

        <div>
          <SectionHeader title={`Decks · ${srs.activeDecks} of ${decks.length} on`} action={<ImportButton mock={mock} />} />
          <DeckList mock={mock} />
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_8 }}>
            Click a deck to browse its cards. Rename, move and delete live on that page, as they do today.
          </div>
        </div>

        <div>
          <SectionHeader title="Review settings" />
          <ReviewSettings />
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_8 }}>
            {concept === 'pages'
              ? 'In B these stay in the page\'s settings sidebar with the card-display settings; shown inline here only so the mock has no sidebar.'
              : 'Card-display settings (furigana, audio, effects) stay in the review drill\'s own sidebar.'}
          </div>
        </div>
      </div>
    </ModuleThemeProvider>
  )
}

function BrowsePlaceholder({ mock }) {
  return (
    <ModuleThemeProvider accent={SRS_ACCENT}>
      <Card padding={SPACE_24} style={{ maxWidth: 820 }}>
        <div style={{ fontSize: FS_CONTENT_HEADING }}>Browse cards</div>
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4, lineHeight: 1.5 }}>
          The existing card browser (#/vocab-srs/browse), unchanged: state tabs, search, select-to-move/delete, rename and delete deck. Only its address and breadcrumb move under Decks.
        </div>
        <div style={{ marginTop: SPACE_16 }}><Button variant="neutral" onClick={() => mock.go('decks')}>Back to decks</Button></div>
      </Card>
    </ModuleThemeProvider>
  )
}

// ── Textbook page (B) and hub (C) ─────────────────────────────────────────────

function BookHeader({ mock }) {
  const { state, note } = mock
  const { textbook, chapters, doneCount, wordsDrilled } = state
  return (
    <div style={{ display: 'flex', gap: SPACE_16, alignItems: 'flex-start', maxWidth: 820 }}>
      <Cover icon={textbook.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS_CONTENT_HEADING }}>{textbook.title}</div>
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{textbook.subtitle} · {doneCount} of {chapters.length} chapters · {wordsDrilled} words drilled</div>
        <div style={{ height: 4, borderRadius: 2, background: HAIRLINE, overflow: 'hidden', margin: `${SPACE_12}px 0` }}>
          <div style={{ height: '100%', width: `${Math.round((doneCount / chapters.length) * 100)}%`, background: VOCAB_ACCENT }} />
        </div>
        <Button variant="neutral" size="sm" onClick={() => note('Open textbook picker')}>Change textbook</Button>
      </div>
    </div>
  )
}

function ChapterPath({ mock }) {
  const { state, sent, startDrill, sendToSrs, setPointer, note } = mock
  const { chapters, current } = state
  const [expanded, setExpanded] = useState(() => new Set([current.id]))

  const glyph = ch => ch.id === current.id ? '▶' : ch.drilled ? '✓' : '○'
  const columns = [
    { key: 'glyph', width: 24, render: ch => <span style={{ color: ch.id === current.id ? VOCAB_ACCENT : ch.drilled ? TEXT : TEXT_MUTED }}>{glyph(ch)}</span> },
    {
      key: 'label',
      flex: 1,
      render: ch => (
        <div>
          <div style={{ fontSize: FS_BASE, color: ch.drilled || ch.id === current.id ? TEXT : TEXT_MUTED }}>{ch.label}</div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{ch.wordCount} words{ch.drilled ? ' · drilled' : ''}</div>
        </div>
      ),
    },
    {
      key: 'badges',
      align: 'right',
      render: ch => (
        <div style={{ display: 'flex', gap: SPACE_4 }}>
          {ch.id === current.id && <Badge tone="accent">Current</Badge>}
          {sent.has(ch.id) && <Badge tone="success">In SRS</Badge>}
        </div>
      ),
    },
  ]

  return (
    <DataList
      columns={columns}
      rows={chapters}
      maxWidth={820}
      expand={{
        expanded,
        onToggle: id => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }),
        render: ch => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, padding: `${SPACE_4}px 0 ${SPACE_8}px` }}>
            <Button size="sm" onClick={() => startDrill(ch, { advance: ch.id === current.id })}>{ch.id === current.id ? 'Start' : 'Drill'}</Button>
            <Button size="sm" variant="neutral" onClick={() => note(`Preview ${ch.label}`)}>Preview</Button>
            <Button size="sm" variant="neutral" disabled={sent.has(ch.id)} onClick={() => sendToSrs(ch)}>{sent.has(ch.id) ? 'In SRS' : 'Send to SRS'}</Button>
            {ch.id !== current.id && <Button size="sm" variant="ghost" onClick={() => setPointer(ch.id)}>Set as current</Button>}
          </div>
        ),
      }}
    />
  )
}

function OtherLists({ mock }) {
  return (
    <Disclosure label="Drill a list from another book">
      <div style={{ marginTop: SPACE_12 }}>
        <FreeDrillPicker mock={mock} compact={mock.isMobile} onStart={(chapter, bookId) => mock.startDrill(chapter, { advance: false, bookId })} />
      </div>
    </Disclosure>
  )
}

function TextbookScreen({ mock }) {
  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
        <BookHeader mock={mock} />
        <div>
          <SectionHeader title="Chapters" />
          <ChapterPath mock={mock} />
        </div>
        <div>
          <SectionHeader title="Other lists" />
          <OtherLists mock={mock} />
        </div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>The drill settings sidebar stays on this page as today (not mocked).</div>
      </div>
    </ModuleThemeProvider>
  )
}

const HUB_TABS = [{ value: 'learn', label: 'Learn' }, { value: 'remember', label: 'Remember' }]

function HubScreen({ mock }) {
  const [tab, setTab] = useState('learn')
  const accent = tab === 'learn' ? VOCAB_ACCENT : SRS_ACCENT
  return (
    <ModuleThemeProvider accent={accent}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
        <div style={{ maxWidth: 420 }}>
          <ChipSelector mode="single" size="md" grow options={HUB_TABS} value={tab} onChange={setTab} />
        </div>
        {tab === 'learn' ? (
          <>
            <BookHeader mock={mock} />
            <div>
              <SectionHeader title="Chapters" />
              <ChapterPath mock={mock} />
            </div>
            <div>
              <SectionHeader title="Other books" />
              <OtherLists mock={mock} />
            </div>
          </>
        ) : (
          <>
            <div>
              <SectionHeader title={`Decks · ${mock.srs.activeDecks} of ${mock.decks.length} on`} action={<ImportButton mock={mock} />} />
              <DeckList mock={mock} mirror />
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_8 }}>
                The book&apos;s deck mirrors the Learn tab: each chapter sent adds its words here. Other modules&apos; decks sit alongside.
              </div>
            </div>
            <div>
              <SectionHeader title="Review settings" />
              <ReviewSettings />
            </div>
          </>
        )}
      </div>
    </ModuleThemeProvider>
  )
}
