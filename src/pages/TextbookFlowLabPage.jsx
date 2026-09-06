import { useState, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import ChipSelector from '../components/Chip.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import Card from '../components/Card.jsx'
import DataList from '../components/DataList.jsx'
import Modal from '../components/Modal.jsx'
import Notice from '../components/Notice.jsx'
import ActionBar from '../components/ActionBar.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import ToggleButton from '../components/ToggleButton.jsx'
import Popover from '../components/Popover.jsx'
import Menu from '../components/Menu.jsx'
import { PrimaryCard } from './homeCards.jsx'
import { FreeDrillSheet } from './HomeFlowLabPage.jsx'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { resolveTextbookState } from '../lib/textbookProgress.js'
import { cardFormOf } from '../lib/displayForm.js'
import { useDictionaryEntries } from '../hooks/useDictionaryEntries.js'
import { cardGloss } from '../utils/dictionaryEntryLookup.js'
import { getTextbook, COVER_GUTTER_FRACTION } from '../data/textbooks.js'
import { MODULES } from '../data/modules.js'
import { WORD_DATA } from '../data/wordData.js'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import {
  BOOK_ID, wordCountFor, INITIAL_DECKS, initialProgress, initialSent, deckTotal, summariseDecks, addChapterToDecks,
} from './homeFlowFixtures.js'
import {
  FONT, KANJI_FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_DISPLAY_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Dev-only bench, round two of #/dev/home-flow, after concept B ("two
// focused pages") was picked. Each open question from that review is an
// independent switch on one live mock — how the tracker advances and
// rewinds, whether advancing is gated on sending words to the SRS, what the
// tracker glyphs look like, cropped clickable covers, where free drill
// lives, the shape of the Decks page header — so any combination can be
// judged together rather than one at a time. Reached at #/dev/textbook-flow;
// written up in docs/home-flow-concepts.md.

const BG = '#1E1E1E'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const DONE_GREY = '#8A8A8A'
const VOCAB_ACCENT = MODULES.find(m => m.id === 'school-vocab').accent
const SRS_ACCENT = MODULES.find(m => m.id === 'vocab-srs').accent

const OPTION_GROUPS = [
  {
    key: 'advance',
    title: 'Advancing',
    options: [
      { value: 'explicit', label: 'Explicit advance', blurb: 'Finishing marks the chapter drilled; the tracker stays. The card\'s primary becomes "Start Lesson 5" (Redo in the chevron menu) and advancing is a deliberate act, which is where the SRS gate hangs.' },
      { value: 'auto', label: 'Auto-advance', blurb: 'Finishing from the card moves the tracker at once. The done screen\'s SRS prompt is the only gate; the card shows "Lesson 4 done today" under "Start Lesson 5".' },
      { value: 'on-start', label: 'Advance on start', blurb: 'Finishing marks drilled; the tracker moves when "Start Lesson 5" is pressed. Closest to today. The gate runs at that press.' },
    ],
  },
  {
    key: 'gate',
    title: 'SRS gate before advancing',
    options: [
      { value: 'dialog', label: 'Dialog', blurb: 'Advancing past a chapter with unsent words opens "Send Lesson 4 to the SRS first?" — send and advance, or advance without.' },
      { value: 'notice', label: 'Inline notice', blurb: 'No interruption: the card and the chapter row carry a warning line ("0 of 63 in SRS") and a Send button. Advancing just advances.' },
      { value: 'none', label: 'None', blurb: 'Only the done screen prompts. Advancing never asks.' },
    ],
  },
  {
    key: 'glyph',
    title: 'Tracker glyphs',
    options: [
      { value: 'ring', label: 'Ring', blurb: 'Current: accent dot with a gapped accent ring. Done: filled grey. Upcoming: hollow.' },
      { value: 'halo', label: 'Halo', blurb: 'Current: accent dot with a soft translucent halo instead of a hard ring.' },
      { value: 'path', label: 'Connected path', blurb: 'Ring, plus a line threading the glyphs — grey behind the tracker, faint ahead of it — so the list reads as a route.' },
    ],
  },
  {
    key: 'cover',
    title: 'Book cover',
    options: [
      { value: 'cropped', label: 'Cropped', blurb: 'The 5/32 transparent gutter each side of the pixel art is cropped away, so the artwork sits flush. Clicking the cover opens the textbook picker (hover reveals "Change").' },
      { value: 'gutter', label: 'As today', blurb: 'Full 32×32 canvas with its gutters, cover still clickable.' },
    ],
  },
  {
    key: 'freeDrill',
    title: 'Free drill',
    options: [
      { value: 'header', label: 'Header action', blurb: 'A "Free drill" button beside the book opens the any-book sheet. Rows already drill any chapter of the current book.' },
      { value: 'none', label: 'Not supported', blurb: 'Drilling another book means changing book. Rows still drill any chapter of the current one.' },
    ],
  },
  {
    key: 'wordList',
    title: 'Lesson word list',
    options: [
      { value: 'badges', label: 'One list, badges', blurb: 'Every word in one list; "In SRS" badge on the ones already sent; tick the rest and send.' },
      { value: 'grouped', label: 'Two groups', blurb: '"Not in SRS" first with selection, "In SRS" read-only below.' },
    ],
  },
  {
    key: 'decksHeader',
    title: 'Decks page header',
    options: [
      { value: 'strip', label: 'Headline + button', blurb: 'The home card\'s line ("21 due · 10 new · ~8 min") as a page headline, Start reviews top right, state bar beneath. No card.' },
      { value: 'stats', label: 'Stat blocks + button', blurb: 'Due / New today / Minutes as the home card\'s stat blocks, Start reviews top right.' },
      { value: 'actionbar', label: 'Sticky action bar', blurb: 'Header is information only; Start reviews lives in the bottom action bar, as the Vocab page\'s Start review does.' },
    ],
  },
]

const DEFAULTS = { advance: 'explicit', gate: 'dialog', glyph: 'halo', cover: 'cropped', freeDrill: 'header', wordList: 'badges', decksHeader: 'strip' }

const wordsOf = chapterId => WORD_DATA.filter(w => w.listKey === chapterId && !w.isSentenceVocab)

// Lesson 3 is only partly sent, so the partial state (row badge, word-list
// split) is on screen from the first click rather than needing setting up.
function initialSentWords() {
  const map = {}
  const ids = [...initialSent()]
  ids.forEach((id, i) => {
    const words = wordsOf(id).map(w => w.id)
    map[id] = new Set(i === ids.length - 1 ? words.slice(0, Math.floor(words.length * 0.75)) : words)
  })
  return map
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TextbookFlowLabPage() {
  const isMobile = useIsMobile()
  const [opts, setOpts] = useState(DEFAULTS)
  const [progress, setProgress] = useState(initialProgress)
  const [decks, setDecks] = useState(INITIAL_DECKS)
  const [sentWords, setSentWords] = useState(initialSentWords)
  // True once the chapter under the tracker has been drilled since the
  // tracker landed on it — what "ready to advance" means. Rewinding clears it.
  const [drilledAtPointer, setDrilledAtPointer] = useState(false)
  const [lastDone, setLastDone] = useState(null)
  const [screen, setScreen] = useState({ name: 'home' })
  const [gateFor, setGateFor] = useState(null)
  const [log, setLog] = useState([])

  const state = resolveTextbookState(progress, wordCountFor)
  const srs = summariseDecks(decks)
  const note = msg => setLog(l => [msg, ...l].slice(0, 6))
  const sentCountOf = ch => sentWords[ch.id]?.size ?? 0
  const fullySent = ch => sentCountOf(ch) >= ch.wordCount && ch.wordCount > 0
  const chapterAfter = ch => state.chapters[state.chapters.findIndex(c => c.id === ch.id) + 1] ?? null

  function setPointer(id, why = 'set') {
    setProgress(p => ({ ...p, textbook: { ...p.textbook, currentChapterId: id } }))
    setDrilledAtPointer(false)
    const label = state.chapters.find(c => c.id === id)?.label
    note(why === 'advance' ? `Advanced to ${label}` : `Tracker moved to ${label}`)
  }

  function startDrill(chapter, { fromCard = false, bookId = BOOK_ID } = {}) {
    setScreen({ name: 'drill', chapter, fromCard, bookId })
    note(`Drill ${chapter.label}${fromCard ? '' : ' (does not move the tracker)'}`)
  }

  function finishDrill() {
    const { chapter, fromCard, bookId } = screen
    if (bookId === BOOK_ID) {
      setProgress(p => ({ ...p, sublists: { ...p.sublists, [chapter.id]: { 'kanji-front': { lastReviewed: new Date().toISOString(), correct: 40, total: chapter.wordCount } } } }))
      if (chapter.id === state.current.id) {
        setLastDone(chapter)
        if (opts.advance === 'auto' && fromCard) {
          const next = chapterAfter(chapter)
          if (next) setPointer(next.id, 'advance')
        } else {
          setDrilledAtPointer(true)
        }
      }
    }
    setScreen({ name: 'done', chapter, bookId })
  }

  function sendWords(chapter, ids, bookId = BOOK_ID) {
    const book = getTextbook(bookId)
    const fresh = ids.filter(id => !sentWords[chapter.id]?.has(id))
    if (fresh.length === 0) return
    setSentWords(m => ({ ...m, [chapter.id]: new Set([...(m[chapter.id] ?? []), ...fresh]) }))
    setDecks(ds => addChapterToDecks(ds, book, fresh.length))
    note(`Sent ${fresh.length} words from ${chapter.label} to the "${book.title}" deck`)
  }
  const sendAll = (chapter, bookId) => sendWords(chapter, wordsOf(chapter.id).map(w => w.id), bookId)

  // The one place the tracker moves forward deliberately. `then` is what
  // the caller wanted to do after (start the next drill, or nothing).
  function advance(from, then) {
    const next = chapterAfter(from)
    if (!next) return
    const unsent = from.wordCount - sentCountOf(from)
    if (opts.gate === 'dialog' && unsent > 0) {
      setGateFor({ from, next, unsent, then })
      return
    }
    setPointer(next.id, 'advance')
    then?.(next)
  }

  function toggleDeck(id) {
    setDecks(ds => ds.map(d => d.id === id ? { ...d, active: !d.active } : d))
  }

  function reset() {
    setProgress(initialProgress())
    setDecks(INITIAL_DECKS)
    setSentWords(initialSentWords())
    setDrilledAtPointer(false)
    setLastDone(null)
    setScreen({ name: 'home' })
    setLog([])
  }

  const go = (name, extra = {}) => setScreen({ name, ...extra })
  const mock = {
    opts, state, srs, decks, screen, isMobile, drilledAtPointer, lastDone,
    sentWords, sentCountOf, fullySent, chapterAfter,
    go, startDrill, finishDrill, sendWords, sendAll, advance, setPointer, toggleDeck, note,
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Home flow', href: '#/dev/home-flow' }, { label: 'Textbook page' }]} />

      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? SPACE_16 : SPACE_24 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Concept B, round two</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 820, lineHeight: 1.5 }}>
            Each question from the review is a switch below; all of them apply to the one mock at once.
            The tracker starts on Lesson 4. Walk it: Start Lesson 4 from the card, finish, answer the
            prompt, then see how each advancing model and gate behaves; on the textbook page, rewind
            with &ldquo;Set as current&rdquo; and open a lesson&apos;s words.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: `${SPACE_16}px 0 0` }}>
            <Button variant="ghost-muted" size="sm" onClick={reset}>Reset state</Button>
          </div>

          <Controls opts={opts} onChange={(key, value) => setOpts(o => ({ ...o, [key]: value }))} />

          <Frame mock={mock} />

          <div style={{ marginTop: SPACE_16, fontSize: FS_CAPTION, color: TEXT_MUTED }}>
            {log.length === 0 ? 'No actions yet.' : log.map((l, i) => <div key={i} style={{ opacity: i === 0 ? 1 : 0.6 }}>{l}</div>)}
          </div>

          <ModuleThemeProvider accent={VOCAB_ACCENT}>
            <GateDialog gate={gateFor} onClose={() => setGateFor(null)} mock={mock} />
          </ModuleThemeProvider>
        </div>
      </main>
    </div>
  )
}

function Controls({ opts, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: SPACE_12, margin: `${SPACE_8}px 0 ${SPACE_16}px` }}>
      {OPTION_GROUPS.map(group => {
        const active = group.options.find(o => o.value === opts[group.key])
        return (
          <Card key={group.key} padding={SPACE_16}>
            <SectionHeader title={group.title} />
            <ChipSelector mode="single" options={group.options} value={opts[group.key]} onChange={v => onChange(group.key, v)} />
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5, marginTop: SPACE_8 }}>{active.blurb}</div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Frame ─────────────────────────────────────────────────────────────────────

const CRUMB = { drill: 'Reviewing', done: 'Session complete', decks: 'Decks', browse: 'Browse cards', textbook: 'Vocabulary Training', preview: 'Words' }

function Frame({ mock }) {
  const { screen, go, opts, srs, note } = mock
  const crumbs = [{ label: 'Japanese Study', onClick: () => go('home') }]
  if (screen.name === 'browse') crumbs.push({ label: 'Decks', onClick: () => go('decks') })
  if (['drill', 'done', 'preview'].includes(screen.name)) crumbs.push({ label: 'Vocabulary Training', onClick: () => go('textbook') })
  if (screen.name !== 'home') crumbs.push({ label: screen.name === 'preview' ? screen.chapter.label : CRUMB[screen.name] })

  const stickyStart = screen.name === 'decks' && opts.decksHeader === 'actionbar'

  return (
    <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: 'hidden', background: BG, display: 'flex', flexDirection: 'column' }}>
      <PageHeader crumbs={crumbs} />
      <div style={{ padding: mock.isMobile ? SPACE_16 : SPACE_24, minHeight: 420 }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {screen.name === 'home' && <HomeScreen mock={mock} />}
          {screen.name === 'textbook' && <TextbookScreen mock={mock} />}
          {screen.name === 'preview' && <PreviewScreen mock={mock} />}
          {screen.name === 'drill' && <DrillScreen mock={mock} />}
          {screen.name === 'done' && <DoneScreen mock={mock} />}
          {screen.name === 'decks' && <DecksScreen mock={mock} />}
          {screen.name === 'browse' && <BrowsePlaceholder mock={mock} />}
        </div>
      </div>
      {stickyStart && (
        <ModuleThemeProvider accent={SRS_ACCENT}>
          <ActionBar maxWidth={820} leading={<span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{srs.due + srs.newToday} cards · ~{srs.estimatedMinutes} min</span>}>
            <Button size="xl" variant="accent-outline" disabled={!srs.canStart} onClick={() => note('Start the SRS review')}>{srs.canStart ? 'Start reviews' : 'Nothing due'}</Button>
          </ActionBar>
        </ModuleThemeProvider>
      )}
    </div>
  )
}

// ── Covers and glyphs ─────────────────────────────────────────────────────────

// Clicking the cover is the change-textbook affordance, as on the home card
// (hover treatment is `.textbook-cover` in global.css). `cropped` cuts the
// pixel art's transparent gutters off both sides.
function Cover({ icon, size = 104, cropped, onClick }) {
  const gutter = cropped ? COVER_GUTTER_FRACTION * size : 0
  const width = size - gutter * 2
  return (
    <button
      type="button"
      className="textbook-cover"
      onClick={onClick}
      title="Change textbook"
      style={{ position: 'relative', width, height: size, flexShrink: 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer', overflow: 'hidden', fontFamily: FONT, letterSpacing: TRACKING }}
    >
      <img className="textbook-cover__art" src={icon} alt="" style={{ width: size, height: size, marginLeft: -gutter, imageRendering: 'pixelated', display: 'block' }} />
      <span className="textbook-cover__label" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS_CAPTION, color: TEXT }}>Change</span>
    </button>
  )
}

function Glyph({ kind, style: glyphStyle }) {
  const size = 12
  const base = { width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0 }
  if (kind === 'done') return <span style={{ ...base, background: DONE_GREY }} />
  if (kind === 'todo') return <span style={{ ...base, border: '1.5px solid rgba(255,255,255,0.3)' }} />
  const halo = glyphStyle === 'halo'
    ? `0 0 0 5px ${VOCAB_ACCENT}40`
    : `0 0 0 2px ${BG}, 0 0 0 4px ${VOCAB_ACCENT}`
  return <span style={{ ...base, background: VOCAB_ACCENT, boxShadow: halo }} />
}

// A main action plus, when there's a real alternative (redo the current
// chapter instead of advancing), a chevron that opens it in a popover menu
// rather than surfacing it as a second visible button. Degrades to a plain
// Button when there's nothing to put in the menu.
function SegmentedPrimary({ size = 'lg', label, onClick, menuItems = [] }) {
  const accent = useAccent()
  const [open, setOpen] = useState(false)
  const chevronRef = useRef(null)

  if (menuItems.length === 0) {
    return <Button size={size} onClick={onClick}>{label}</Button>
  }

  const pad = size === 'xl' ? `${SPACE_12}px ${SPACE_32}px` : `10px ${SPACE_24}px`
  // The chevron segment is a perfect square sized to the main button's own
  // rendered height (2× its vertical padding + one line of FS_BASE text) —
  // computed explicitly rather than via CSS aspect-ratio, which a flex row
  // with align-items: stretch doesn't resolve reliably (the cross-axis size
  // isn't "definite" yet when the aspect-ratio width would need it, so
  // Chromium falls back to the glyph's own tiny content width instead).
  const square = (size === 'xl' ? SPACE_12 : 10) * 2 + FS_BASE

  return (
    <div style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', boxSizing: 'border-box' }}>
      <button
        type="button"
        className="btn btn-tint"
        onClick={onClick}
        style={{
          background: accent, border: 'none', boxSizing: 'border-box', flexShrink: 0, whiteSpace: 'nowrap',
          color: '#fff', padding: pad, fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1, cursor: 'pointer',
        }}
      >
        {label}
      </button>
      <button
        ref={chevronRef}
        type="button"
        className="btn btn-tint"
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        style={{
          background: accent, border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', boxSizing: 'border-box', flexShrink: 0,
          color: '#fff', padding: 0, width: square, height: square, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_CAPTION, lineHeight: 1, cursor: 'pointer',
        }}
      >
        ▾
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={chevronRef} align="end" width={200} bodyPadding={0}>
        <Menu items={menuItems} onSelect={id => { setOpen(false); menuItems.find(i => i.id === id)?.onClick() }} />
      </Popover>
    </div>
  )
}

// Shared between the home card and the textbook page header, which show the
// same primary action for the chapter under the tracker — redo goes in the
// segmented button's menu instead of sitting beside it as its own button.
function chapterPrimaryAction(mock) {
  const { state, opts, drilledAtPointer, lastDone, sentCountOf, fullySent, chapterAfter, startDrill, advance, note } = mock
  const { chapters, current, doneCount } = state
  if (doneCount === chapters.length) {
    return { label: 'Pick new textbook', onClick: () => note('Open textbook picker'), menuItems: [], body: null }
  }
  const next = chapterAfter(current)
  const inSrsLine = ch => fullySent(ch) ? 'in SRS' : `${sentCountOf(ch)} of ${ch.wordCount} in SRS`
  let label, onClick, menuItems = [], body = null

  if (opts.advance === 'auto') {
    label = `Start ${current.label}`
    onClick = () => startDrill(current, { fromCard: true })
    if (lastDone && lastDone.id !== current.id) {
      body = <Line>{lastDone.label} done today · {inSrsLine(lastDone)}</Line>
      menuItems = [{ id: 'redo-last', label: `Redo ${lastDone.label}`, onClick: () => startDrill(lastDone, { fromCard: false }) }]
    }
  } else if (drilledAtPointer && next) {
    body = <Line>{current.label} drilled ✓ · {inSrsLine(current)}</Line>
    menuItems = [{ id: 'redo', label: `Redo ${current.label}`, onClick: () => startDrill(current, { fromCard: false }) }]
    if (opts.advance === 'explicit') {
      label = `Start ${next.label}`
      onClick = () => advance(current)
    } else {
      label = `Start ${next.label}`
      onClick = () => advance(current, n => startDrill(n, { fromCard: true }))
    }
  } else {
    label = `${current.drilled ? 'Redo' : 'Start'} ${current.label}`
    onClick = () => startDrill(current, { fromCard: true })
  }

  return { label, onClick, menuItems, body }
}

// ── Home ──────────────────────────────────────────────────────────────────────

function HomeScreen({ mock }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mock.isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: SPACE_12 }}>
      <NewCard mock={mock} />
      <ReviewCard mock={mock} />
    </div>
  )
}

// Only ever two buttons on a card: the (possibly segmented) primary, then
// the one secondary action, side by side rather than a quiet link row above.
function ActionsRow({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>{children}</div>
}

function NewCard({ mock }) {
  const { state, opts, sentCountOf, drilledAtPointer, sendAll, go, note } = mock
  const { textbook, chapters, current, doneCount } = state
  const complete = doneCount === chapters.length
  const cover = <Cover icon={textbook.icon} cropped={opts.cover === 'cropped'} onClick={() => note('Open textbook picker')} />
  const viewChapters = <Button variant="ghost" size="lg" onClick={() => go('textbook')}>View chapters</Button>
  const { label, onClick, menuItems, body } = chapterPrimaryAction(mock)

  const unsent = complete ? 0 : current.wordCount - sentCountOf(current)
  const showNotice = !complete && opts.gate === 'notice' && drilledAtPointer && unsent > 0 && opts.advance !== 'auto'

  return (
    <PrimaryCard
      accent={VOCAB_ACCENT}
      title={textbook.title}
      subtitle={complete ? 'Book completed' : `${doneCount} of ${chapters.length} chapters`}
      cover={cover}
      progress={complete ? 1 : (chapters.length ? doneCount / chapters.length : 0)}
      actions={
        <ActionsRow>
          <SegmentedPrimary size="lg" label={label} onClick={onClick} menuItems={menuItems} />
          {viewChapters}
        </ActionsRow>
      }
    >
      {showNotice ? (
        <Notice tone="warning" title={`${unsent} words from ${current.label} not in the SRS`}>
          <Button size="sm" variant="warning-outline" onClick={() => sendAll(current)}>Send {unsent} now</Button>
        </Notice>
      ) : body}
    </PrimaryCard>
  )
}

function Line({ children }) {
  return <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{children}</div>
}

function ReviewCard({ mock }) {
  const { srs, go, note } = mock
  const { due, newToday, newWaiting, totalCards, activeDecks, canStart, estimatedMinutes } = srs
  const headline = canStart ? `${due} due · ${newToday} new · ~${estimatedMinutes} min` : 'Nothing due'
  const caption = [`${activeDecks} active ${activeDecks === 1 ? 'deck' : 'decks'}`, `${totalCards} cards`, newWaiting > 0 ? `${newWaiting} new waiting` : null].filter(Boolean).join(' · ')
  return (
    <PrimaryCard accent={SRS_ACCENT} title="Reviews" subtitle={headline}
      actions={
        <ActionsRow>
          <Button size="lg" disabled={!canStart} onClick={() => note('Start the SRS review')}>{canStart ? `Review ${due + newToday} cards` : 'Nothing due'}</Button>
          <Button variant="ghost" size="lg" onClick={() => go('decks')}>Manage decks</Button>
        </ActionsRow>
      }
    >
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{caption}</div>
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

// ── Textbook page ─────────────────────────────────────────────────────────────

function TextbookScreen({ mock }) {
  const { state, opts, note } = mock
  const { textbook, chapters, doneCount, wordsDrilled } = state
  const [freeOpen, setFreeOpen] = useState(false)
  const { label, onClick, menuItems } = chapterPrimaryAction(mock)
  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
        <div style={{ display: 'flex', gap: SPACE_16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: SPACE_16, alignItems: 'flex-start', flex: 1, minWidth: 260 }}>
            <Cover icon={textbook.icon} cropped={opts.cover === 'cropped'} onClick={() => note('Open textbook picker')} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FS_CONTENT_HEADING }}>{textbook.title}</div>
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{textbook.subtitle} · {doneCount} of {chapters.length} chapters · {wordsDrilled} words drilled</div>
              <div style={{ height: 4, borderRadius: 2, background: HAIRLINE, overflow: 'hidden', marginTop: SPACE_12 }}>
                <div style={{ height: '100%', width: `${Math.round((doneCount / chapters.length) * 100)}%`, background: VOCAB_ACCENT }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: SPACE_8, flexShrink: 0 }}>
            {opts.freeDrill === 'header' && <Button variant="ghost" size="lg" onClick={() => setFreeOpen(true)}>Free drill</Button>}
            <SegmentedPrimary size="lg" label={label} onClick={onClick} menuItems={menuItems} />
          </div>
        </div>

        <div>
          <SectionHeader title="Chapters" />
          <ChapterPath mock={mock} />
        </div>

        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>The drill settings sidebar stays on this page as today (not mocked).</div>
      </div>
      <FreeDrillSheet open={freeOpen} onClose={() => setFreeOpen(false)} mock={{ ...mock, startDrill: (ch, o) => mock.startDrill(ch, { fromCard: false, bookId: o?.bookId }) }} />
    </ModuleThemeProvider>
  )
}

function ChapterPath({ mock }) {
  const { state, opts, drilledAtPointer, sentCountOf, fullySent, chapterAfter, startDrill, sendAll, advance, setPointer, go } = mock
  const { chapters, current } = state
  const [openId, setOpenId] = useState(current.id)
  const currentIndex = chapters.findIndex(ch => ch.id === current.id)
  const next = chapterAfter(current)

  return (
    <div style={{ background: '#2A2A2A', border: `1px solid ${HAIRLINE}`, borderRadius: 8, overflow: 'hidden' }}>
      {chapters.map((ch, i) => {
        const isCurrent = ch.id === current.id
        const kind = isCurrent ? 'current' : ch.drilled ? 'done' : 'todo'
        const open = openId === ch.id
        const sentN = sentCountOf(ch)
        const unsent = ch.wordCount - sentN
        const behind = i <= currentIndex
        const meta = [`${ch.wordCount} words`, ch.drilled ? 'drilled' : null].filter(Boolean).join(' · ')
        const showRowNotice = opts.gate === 'notice' && isCurrent && drilledAtPointer && unsent > 0

        return (
          <div key={ch.id} style={{ borderTop: i === 0 ? 'none' : `1px solid rgba(255,255,255,0.06)` }}>
            <div
              className="data-list-row"
              onClick={() => setOpenId(open ? null : ch.id)}
              style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', alignItems: 'center', gap: SPACE_12, padding: '10px 14px', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ position: 'relative', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {opts.glyph === 'path' && (
                  <>
                    {i > 0 && <span style={{ position: 'absolute', left: 'calc(50% - 1px)', top: -11, height: 'calc(50% + 11px - 6px)', width: 2, background: behind ? DONE_GREY : 'rgba(255,255,255,0.12)' }} />}
                    {i < chapters.length - 1 && <span style={{ position: 'absolute', left: 'calc(50% - 1px)', bottom: -11, height: 'calc(50% + 11px - 6px)', width: 2, background: i < currentIndex ? DONE_GREY : 'rgba(255,255,255,0.12)' }} />}
                  </>
                )}
                <Glyph kind={kind} style={opts.glyph} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: FS_BASE, color: ch.drilled || isCurrent ? TEXT : TEXT_MUTED }}>{ch.label}</div>
                <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{meta}</div>
              </div>
              <div style={{ display: 'flex', gap: SPACE_4, alignItems: 'center' }}>
                {isCurrent && <Badge tone="accent">Current</Badge>}
                {fullySent(ch) ? <Badge tone="success">In SRS</Badge> : sentN > 0 ? <Badge tone="warning" variant="text">{sentN} of {ch.wordCount} in SRS</Badge> : null}
                <span style={{ color: TEXT_MUTED, fontSize: FS_CAPTION, marginLeft: SPACE_4 }}>{open ? '▾' : '›'}</span>
              </div>
            </div>
            {open && (
              <div style={{ padding: `0 14px 12px 54px`, display: 'flex', flexDirection: 'column', gap: SPACE_8 }}>
                {showRowNotice && (
                  <Notice tone="warning" title={`${unsent} words not in the SRS`}>
                    <Button size="sm" variant="warning-outline" onClick={() => sendAll(ch)}>Send {unsent} now</Button>
                  </Notice>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8 }}>
                  <Button size="sm" onClick={() => startDrill(ch, { fromCard: isCurrent })}>{isCurrent ? (drilledAtPointer ? 'Redo' : 'Start') : 'Drill'}</Button>
                  <Button size="sm" variant="neutral" onClick={() => go('preview', { chapter: ch })}>Words</Button>
                  <Button size="sm" variant="neutral" disabled={fullySent(ch)} onClick={() => sendAll(ch)}>{fullySent(ch) ? 'In SRS' : unsent < ch.wordCount ? `Send remaining ${unsent}` : 'Send to SRS'}</Button>
                  {isCurrent && drilledAtPointer && next && opts.advance === 'explicit' && (
                    <Button size="sm" variant="accent-outline" onClick={() => advance(ch)}>Start {next.label}</Button>
                  )}
                  {!isCurrent && <Button size="sm" variant="ghost" onClick={() => setPointer(ch.id)}>Set as current</Button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Lesson word list ──────────────────────────────────────────────────────────

function PreviewScreen({ mock }) {
  const { screen, opts, sentWords, sendWords } = mock
  const chapter = screen.chapter
  const words = wordsOf(chapter.id)
  const inSrs = sentWords[chapter.id] ?? new Set()
  const [selected, setSelected] = useState(() => new Set())
  const [expanded, setExpanded] = useState(() => new Set())
  const notIn = words.filter(w => !inSrs.has(w.id))

  // Genki words carry only a jmdictId; form, reading and gloss come from
  // the dictionary, exactly as the drill resolves them.
  const { entries } = useDictionaryEntries(words.map(w => w.jmdictId))
  const formOf = w => cardFormOf(w, entries[w.jmdictId]).form ?? '…'
  const readingOf = w => cardFormOf(w, entries[w.jmdictId]).reading ?? null
  const glossOf = w => {
    const g = w.english ?? cardGloss(w, entries[w.jmdictId])
    return Array.isArray(g) ? g.join('; ') : (g ?? '')
  }
  const columns = [
    { key: 'word', flex: 1.2, render: w => {
      const form = formOf(w)
      const reading = readingOf(w)
      return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE_8, minWidth: 0 }}>
          <span style={{ fontFamily: KANJI_FONT, fontSize: 18 }}>{form}</span>
          {reading && reading !== form && <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{reading}</span>}
        </div>
      )
    } },
    { key: 'english', flex: 2, tone: 'muted', render: w => glossOf(w) },
    ...(opts.wordList === 'badges' ? [{ key: 'srs', align: 'right', render: w => inSrs.has(w.id) ? <Badge tone="success">In SRS</Badge> : null }] : []),
  ]
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const expandProps = { expanded, onToggle: id => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }), render: w => <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{w.sentence ?? 'Kanji breakdown, example sentence, dictionary link — as the preview screen shows today.'}</div> }
  const selectedNotIn = [...selected].filter(id => !inSrs.has(id))

  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center', padding: '10px 14px' }}>
      <Button size="sm" variant="neutral" onClick={() => setSelected(new Set(notIn.map(w => w.id)))} disabled={notIn.length === 0}>Select all not in SRS</Button>
      <Button size="sm" disabled={selectedNotIn.length === 0} onClick={() => { sendWords(chapter, selectedNotIn); setSelected(new Set()) }}>Send {selectedNotIn.length || ''} to SRS</Button>
    </div>
  )

  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
        <div>
          <div style={{ fontSize: FS_CONTENT_HEADING }}>{chapter.label}</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{words.length} words · {inSrs.size} in the SRS</div>
        </div>
        {opts.wordList === 'badges' ? (
          <DataList columns={columns} rows={words} maxWidth={820} selection={{ selected, onToggle: toggle, bulkHeader: true }} footer={footer} />
        ) : (
          <>
            <div>
              <SectionHeader title={`Not in SRS · ${notIn.length}`} />
              <DataList columns={columns} rows={notIn} maxWidth={820} selection={{ selected, onToggle: toggle, bulkHeader: true }} footer={footer} emptyMessage="Every word in this lesson is in the SRS." />
            </div>
            <div>
              <SectionHeader title={`In SRS · ${inSrs.size}`} />
              <DataList columns={columns} rows={words.filter(w => inSrs.has(w.id))} maxWidth={820} expand={expandProps} emptyMessage="None sent yet." />
            </div>
          </>
        )}
      </div>
    </ModuleThemeProvider>
  )
}

// ── Drill, done, gate ─────────────────────────────────────────────────────────

function DrillScreen({ mock }) {
  const { screen, finishDrill } = mock
  return (
    <ModuleThemeProvider accent={VOCAB_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_16, padding: `${SPACE_32}px 0` }}>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>The drill itself is unchanged</div>
        <Card padding={SPACE_24} style={{ width: 'min(380px, 100%)', textAlign: 'center' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING }}>{screen.chapter.label}</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{screen.chapter.wordCount ?? wordCountFor(screen.chapter.id)} words</div>
        </Card>
        <Button size="lg" onClick={finishDrill}>Finish session</Button>
      </div>
    </ModuleThemeProvider>
  )
}

function DoneScreen({ mock }) {
  const { screen, state, opts, sentCountOf, fullySent, chapterAfter, sendAll, startDrill, advance, go, note } = mock
  const { chapter, bookId } = screen
  const book = getTextbook(bookId)
  const count = chapter.wordCount ?? wordCountFor(chapter.id)
  const isBook = bookId === BOOK_ID
  const alreadySent = isBook && fullySent(chapter)
  const unsent = isBook ? count - sentCountOf(chapter) : count
  const [skipped, setSkipped] = useState(false)
  const done = alreadySent || skipped

  const isCurrent = isBook && chapter.id === state.current.id
  const next = isBook ? chapterAfter(chapter) : null
  let primary = null
  if (isBook && opts.advance === 'auto' && !isCurrent && state.current && !state.current.drilled) {
    primary = <Button size="lg" onClick={() => startDrill(state.current, { fromCard: true })}>Start {state.current.label}</Button>
  } else if (isCurrent && next && opts.advance === 'explicit') {
    primary = <Button size="lg" onClick={() => { advance(chapter); go('home') }}>Start {next.label}</Button>
  } else if (isCurrent && next && opts.advance === 'on-start') {
    primary = <Button size="lg" onClick={() => advance(chapter, n => startDrill(n, { fromCard: true }))}>Start {next.label}</Button>
  }

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
            <Notice tone={alreadySent ? 'success' : 'neutral'} title={alreadySent ? `In your "${book.title}" deck` : 'Not sent'}>
              {alreadySent ? 'Every word in this lesson is already in the SRS.' : 'You can send them later from the lesson\'s word list.'}
            </Notice>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>
                {unsent} of {count} words are not in the SRS yet. Send them to the &ldquo;{book.title}&rdquo; deck, or pick individual words from the lesson&apos;s word list.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>
                <Button onClick={() => { sendAll(chapter, bookId); note('Sent from the done screen') }}>Send {unsent} to SRS</Button>
                {isBook && <Button variant="neutral" onClick={() => go('preview', { chapter })}>Choose words</Button>}
                <Button variant="ghost-muted" size="sm" onClick={() => setSkipped(true)}>Not now</Button>
              </div>
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, justifyContent: 'center' }}>
          {primary}
          <Button variant="neutral" size="lg" onClick={() => startDrill(chapter, { fromCard: false, bookId })}>Redo troubled</Button>
          <Button variant="neutral" size="lg" onClick={() => go('textbook')}>Back to book</Button>
        </div>
      </div>
    </ModuleThemeProvider>
  )
}

function GateDialog({ gate, onClose, mock }) {
  const { sendAll, setPointer } = mock
  if (!gate) return null
  const { from, next, unsent, then } = gate
  function proceed(send) {
    if (send) sendAll(from)
    setPointer(next.id, 'advance')
    onClose()
    then?.(next)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Send ${from.label} to the SRS first?`}
      size="sm"
      isMobile={mock.isMobile}
      footer={
        <>
          <Button variant="neutral" onClick={() => proceed(false)}>Skip</Button>
          <Button onClick={() => proceed(true)}>Add {unsent} to SRS</Button>
        </>
      }
    >
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>
        {unsent} of {from.wordCount} words from {from.label} aren&apos;t in your review queue. Once you move on to {next.label} they&apos;re easy to forget about.
      </div>
    </Modal>
  )
}

// ── Decks page ────────────────────────────────────────────────────────────────

function DecksScreen({ mock }) {
  const { srs, opts, decks, note, toggleDeck, go } = mock
  const headline = srs.canStart ? `${srs.due} due · ${srs.newToday} new · ~${srs.estimatedMinutes} min` : 'Nothing due'
  const caption = `${srs.activeDecks} active ${srs.activeDecks === 1 ? 'deck' : 'decks'} · ${srs.totalCards} cards${srs.newWaiting > 0 ? ` · ${srs.newWaiting} new waiting` : ''}`
  const startButton = (
    <Button size="lg" disabled={!srs.canStart} onClick={() => note('Start the SRS review')}>{srs.canStart ? 'Start reviews' : 'Nothing due'}</Button>
  )
  const bar = <DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: decks.filter(d => d.active).reduce((n, d) => n + (d.dist[s.key] ?? 0), 0) }))} />

  const columns = [
    { key: 'name', flex: 2, render: d => (
      <div>
        <div style={{ fontSize: FS_BASE, color: d.active ? TEXT : TEXT_MUTED }}>{d.name}</div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{deckTotal(d)} cards · {d.due} due · {d.newAvailable} new</div>
      </div>
    ) },
    { key: 'dist', flex: 1.4, render: d => <div style={{ width: '100%' }}><DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: d.dist[s.key] ?? 0 }))} showLegend={false} /></div> },
    { key: 'toggle', width: 64, align: 'right', render: d => <span onClick={e => e.stopPropagation()}><ToggleButton active={d.active} labels={{ on: 'On', off: 'Off' }} onClick={() => toggleDeck(d.id)} /></span> },
  ]

  return (
    <ModuleThemeProvider accent={SRS_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE_16, flexWrap: 'wrap' }}>
            {opts.decksHeader === 'stats' ? (
              <div>
                <div style={{ display: 'flex', gap: SPACE_24 }}>
                  <Stat value={srs.due} label="Due" />
                  <Stat value={srs.newToday} label="New today" />
                  <Stat value={srs.canStart ? `~${srs.estimatedMinutes}` : '0'} label="Minutes" />
                </div>
                <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_8 }}>{caption}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: FS_CONTENT_HEADING }}>{headline}</div>
                <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{caption}</div>
              </div>
            )}
            {opts.decksHeader !== 'actionbar' && startButton}
          </div>
          <div style={{ marginTop: SPACE_16 }}>{bar}</div>
        </div>

        <div>
          <SectionHeader title={`Decks · ${srs.activeDecks} of ${decks.length} on`} action={<Button variant="neutral" size="sm" onClick={() => note('Import menu (existing flows)')}>Import ▾</Button>} />
          <DataList columns={columns} rows={decks} maxWidth={820} navigate={{ onClick: () => go('browse') }} />
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_8 }}>Click a deck to browse its cards. Review settings (daily new, leech, Hard/Easy) stay in the settings sidebar.</div>
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
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>The existing card browser, unchanged.</div>
        <div style={{ marginTop: SPACE_16 }}><Button variant="neutral" onClick={() => mock.go('decks')}>Back to decks</Button></div>
      </Card>
    </ModuleThemeProvider>
  )
}
