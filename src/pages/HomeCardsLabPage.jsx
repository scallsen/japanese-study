import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import ChipSelector from '../components/Chip.jsx'
import { NewCard, ReviewCard } from './homeCards.jsx'
import { resolveTextbookState } from '../lib/textbookProgress.js'
import { getTextbook } from '../data/textbooks.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Dev-only harness for the home page's two primary cards — every state they
// can be in, side by side, so a layout change can be judged against all of
// them at once instead of whichever one the real dashboard happens to be
// showing. Same pattern as ToastLabPage/StyleGuideLabPage: not linked from
// the dashboard, reached at #/dev/home-cards.
//
// The cards themselves are the real ones (src/pages/homeCards.jsx) — only
// their inputs are fabricated here.

const BG = '#1E1E1E'

// Every chapter has words except the books that genuinely ship none yet, so
// the "no words yet" state below is the real one rather than a special case.
const wordCountFor = id => (id.startsWith('genki') ? 0 : 20)

// Builds the progress payload the real resolver reads, so these states are
// resolved by production code rather than hand-shaped objects that could
// drift from it.
function textbookState(bookId, { drilledCount = 0, pointer = null } = {}) {
  const book = getTextbook(bookId)
  const sublists = {}
  for (const chapter of book.chapters.slice(0, drilledCount)) {
    sublists[chapter.id] = { 'kanji-front': { lastReviewed: '2026-09-01T00:00:00Z', correct: 18, total: 20 } }
  }
  return resolveTextbookState({ textbook: { id: bookId, currentChapterId: pointer }, sublists }, wordCountFor)
}

const NEW_STATES = [
  {
    key: 'loading',
    label: 'Loading',
    note: 'Progress not resolved yet',
    props: { loading: true },
  },
  {
    key: 'empty',
    label: 'No textbook chosen',
    note: 'First visit — nothing selected',
    props: { state: null },
  },
  {
    key: 'fresh',
    label: 'Chosen, nothing started',
    note: 'One primary action',
    props: { state: textbookState('nsm-n3') },
  },
  {
    key: 'in-progress',
    label: 'Current chapter drilled',
    note: 'Start next + Continue current',
    props: { state: textbookState('nsm-n3', { drilledCount: 4, pointer: 'nsm-n3-w2d1' }) },
  },
  {
    key: 'next-untouched',
    label: 'Mid-book, current not drilled',
    note: 'Progress made, one action again',
    props: { state: textbookState('nsm-n3', { drilledCount: 5 }) },
  },
  {
    key: 'complete',
    label: 'Book complete',
    note: 'Every chapter drilled',
    props: { state: textbookState('nsm-n3', { drilledCount: 12 }) },
  },
  {
    key: 'no-words',
    label: 'Book with no words yet',
    note: 'Chapters listed, nothing to drill',
    props: { state: textbookState('genki-1') },
  },
  {
    key: 'long',
    label: 'Long title + long labels',
    note: 'Wrapping stress test',
    props: { state: textbookState('marugoto-a1-katsudou', { drilledCount: 3, pointer: 'marugoto-a1-katsudou-t3' }) },
  },
]

const REVIEW_STATES = [
  {
    key: 'loading',
    label: 'Loading',
    note: 'Auth or progress still resolving',
    props: { loading: true },
  },
  {
    key: 'signed-out',
    label: 'Signed out',
    note: 'Sign-in is the only action',
    props: { signedOut: true },
  },
  {
    key: 'no-cards',
    label: 'Signed in, no cards',
    note: 'Nothing sent to the SRS yet',
    props: { summary: null },
  },
  {
    key: 'due',
    label: 'Reviews waiting',
    note: 'The everyday state',
    props: { summary: { due: 24, newToday: 10, newWaiting: 120, totalCards: 480, activeDecks: 2, canStart: true } },
  },
  {
    key: 'new-only',
    label: 'Nothing due, new available',
    note: 'Only new cards left today',
    props: { summary: { due: 0, newToday: 10, newWaiting: 340, totalCards: 480, activeDecks: 2, canStart: true } },
  },
  {
    key: 'caught-up',
    label: 'All caught up',
    note: 'Primary action disabled',
    props: { summary: { due: 0, newToday: 0, newWaiting: 0, totalCards: 480, activeDecks: 2, canStart: false } },
  },
  {
    key: 'big',
    label: 'Large numbers',
    note: 'Backlog after time away',
    props: { summary: { due: 148, newToday: 20, newWaiting: 1240, totalCards: 2007, activeDecks: 3, canStart: true } },
  },
]

// The two real home-page bands, plus the narrower ends of each, since the
// cards' proportions are the thing being iterated on.
const WIDTH_OPTIONS = [
  { value: 360, label: '360 (mobile)' },
  { value: 400, label: '400 (with rail)' },
  { value: 480, label: '480 (rail below)' },
  { value: 560, label: '560 (wide)' },
]

// Pairs worth seeing together: bottom-alignment between the two cards only
// reads when both are on screen in the same row.
const PAIRS = [
  { key: 'first-run', label: 'First run', newKey: 'empty', reviewKey: 'signed-out' },
  { key: 'typical', label: 'Typical returning user', newKey: 'in-progress', reviewKey: 'due' },
  { key: 'done', label: 'Studied everything today', newKey: 'complete', reviewKey: 'caught-up' },
]

export default function HomeCardsLabPage() {
  const [width, setWidth] = useState(400)
  const [lastAction, setLastAction] = useState(null)

  // Real handlers would navigate away from the lab; these just report.
  const handlers = {
    onStart: chapter => setLastAction(`onStart(${chapter.id})`),
    onChangeTextbook: () => setLastAction('onChangeTextbook()'),
    onSignIn: () => setLastAction('onSignIn()'),
  }

  const byKey = (list, key) => list.find(s => s.key === key)

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Home cards' }]} />

      <main style={{ flex: 1, overflowY: 'auto', padding: SPACE_24 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Home card states</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 720, lineHeight: 1.5 }}>
            The real <code>NewCard</code> and <code>ReviewCard</code> with fabricated inputs. Edit
            <code> src/pages/homeCards.jsx</code> and every state below updates together.
            Card height still follows the window&apos;s own breakpoint, not the column width picked
            here — check true mobile by narrowing the browser.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_16, margin: `${SPACE_24}px 0` }}>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Column width</span>
            <ChipSelector mode="single" options={WIDTH_OPTIONS} value={width} onChange={setWidth} />
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 'auto' }}>
              {lastAction ? `Last action: ${lastAction}` : 'No action yet'}
            </span>
          </div>

          <StateGrid
            title="New card"
            width={width}
            states={NEW_STATES}
            render={props => <NewCard {...props} onStart={handlers.onStart} onChangeTextbook={handlers.onChangeTextbook} />}
          />

          <StateGrid
            title="Review card"
            width={width}
            states={REVIEW_STATES}
            render={props => <ReviewCard {...props} onSignIn={handlers.onSignIn} />}
          />

          <div style={{ marginTop: SPACE_32 }}>
            <SectionHeader title="Pairs — as they sit on the home page" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
              {PAIRS.map(pair => (
                <div key={pair.key}>
                  <Caption label={pair.label} note="Both cards' primary buttons should share a baseline" />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(2, ${width}px)`,
                    gap: SPACE_12,
                  }}>
                    <NewCard
                      {...byKey(NEW_STATES, pair.newKey).props}
                      onStart={handlers.onStart}
                      onChangeTextbook={handlers.onChangeTextbook}
                    />
                    <ReviewCard {...byKey(REVIEW_STATES, pair.reviewKey).props} onSignIn={handlers.onSignIn} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StateGrid({ title, width, states, render }) {
  return (
    <div style={{ marginTop: SPACE_32 }}>
      <SectionHeader title={title} />
      {/* flex-start, not the default stretch: a stretched cell would make the
          card's own height: 100% resolve against a box that includes this
          caption, and the card would overflow it. Equal heights are what the
          Pairs section below is for — there the cards are real grid siblings. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_24, alignItems: 'flex-start' }}>
        {states.map(state => (
          <div key={state.key} style={{ width }}>
            <Caption label={state.label} note={state.note} />
            {render(state.props)}
          </div>
        ))}
      </div>
    </div>
  )
}

function Caption({ label, note }) {
  return (
    <div style={{ marginBottom: SPACE_8 }}>
      <div style={{ fontSize: FS_CAPTION, color: TEXT }}>{label}</div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, opacity: 0.7 }}>{note}</div>
    </div>
  )
}
