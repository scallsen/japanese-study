import { useState } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import PageHeader from '../components/PageHeader.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import TextbookPicker from '../components/TextbookPicker.jsx'
import { NewCard, ReviewCard } from './homeCards.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { MODULES } from '../data/modules.js'
import { WORD_DATA } from '../data/wordData.js'
import { resolveTextbookState } from '../lib/textbookProgress.js'
import { migrateProgress } from '../modules/vocab-srs/migrate.js'
import { getGlobalStats, getStateDistribution, getTodaysQueue } from '../modules/vocab-srs/srs.js'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import { safeLocalStorageGet } from '../utils/storage.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE,
  SPACE_4, SPACE_12, SPACE_16, SPACE_24,
} from '../data/theme.js'

const SECONDARY_MODULES = MODULES.filter(m => m.tier !== 'primary')

const SIDEBAR_WIDTH = 280
// Below this the right-hand sidebar would squeeze the two primary cards into
// tall, narrow slivers, so it moves under them as a full-width stats strip
// and the cards get their squarer proportions back.
const SIDEBAR_BREAKPOINT = 1100

// Sentence-review words are extras layered onto a list, not part of the
// textbook's own chapter — they don't count toward a chapter's size.
const WORD_COUNT_BY_LIST = WORD_DATA.reduce((map, w) => {
  if (!w.isSentenceVocab) map[w.listKey] = (map[w.listKey] ?? 0) + 1
  return map
}, {})
const wordCountFor = id => WORD_COUNT_BY_LIST[id] ?? 0

function readDailyNewCards() {
  const raw = safeLocalStorageGet('srs-daily-new-cards')
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : 10
}

// Mirrors the queue maths on the SRS home so the Review card promises the
// same session the module would actually start.
function summariseSrs(raw) {
  const progress = migrateProgress(raw)
  const decks = progress.decks ?? {}
  const cards = progress.cards ?? {}
  const todayStr = new Date().toISOString().split('T')[0]
  const newCardDay = progress.newCardDay ?? { date: '', count: 0 }
  const introducedToday = newCardDay.date === todayStr ? newCardDay.count : 0
  const newPerDay = Math.max(0, readDailyNewCards() - introducedToday)
  const { due, newCards, rescheduled } = getTodaysQueue(cards, decks, { newPerDay })
  const global = getGlobalStats(cards, decks)
  return {
    due: due.length + rescheduled.length,
    newToday: newCards.length,
    newWaiting: Math.max(0, global.newAvailable - newCards.length),
    totalCards: global.totalCards,
    activeDecks: global.activeDecks,
    learned: global.learned,
    totalReviews: progress.totalReviews ?? 0,
    distribution: getStateDistribution(cards, decks),
    canStart: due.length > 0 || newCards.length > 0 || rescheduled.length > 0,
  }
}

function navigate(hash) {
  window.location.hash = hash
}

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const sidebarBelow = useIsMobile(SIDEBAR_BREAKPOINT)
  const { user, loading: authLoading, signIn } = useAuth()
  const signedOut = !authLoading && !user

  const { data: vocabProgress, save: saveVocabProgress, loading: vocabLoading } = useProgress('vocab-flashcard')
  const { data: srsRaw, loading: srsLoading } = useProgress('vocab-srs')
  const { data: immersionProgress } = useProgress('immersion')
  const { data: animeTracking } = useProgress('anime-vocab-tracking')

  const [pickerOpen, setPickerOpen] = useState(false)

  const textbookState = vocabLoading ? null : resolveTextbookState(vocabProgress, wordCountFor)
  const srs = user && !srsLoading && srsRaw ? summariseSrs(srsRaw) : null

  function chooseTextbook(id) {
    saveVocabProgress({ ...(vocabProgress ?? {}), textbook: { id, currentChapterId: null } })
  }

  function startChapter(chapter) {
    const textbook = vocabProgress?.textbook
    if (textbook && textbook.currentChapterId !== chapter.id) {
      saveVocabProgress({ ...vocabProgress, textbook: { ...textbook, currentChapterId: chapter.id } })
    }
    navigate(`#/vocab?chapter=${encodeURIComponent(chapter.id)}&start=1`)
  }

  const stats = (
    <StatsPanel
      columns={sidebarBelow && !isMobile ? 3 : 1}
      textbookState={textbookState}
      signedOut={signedOut}
      srs={srs}
      articlesRead={Object.keys(immersionProgress?.read ?? {}).length}
      seriesTracked={Object.keys(animeTracking?.tracked ?? {}).length}
    />
  )

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study' }]} rightSlot={<AuthSlot />} />

      <main style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? '20px 16px' : '28px 28px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: sidebarBelow ? '1fr' : `minmax(0, 1fr) ${SIDEBAR_WIDTH}px`,
            gap: SPACE_24,
            maxWidth: 1120,
            margin: '0 auto',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24, minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: SPACE_12,
              }}>
                <NewCard
                  loading={vocabLoading}
                  state={textbookState}
                  onStart={startChapter}
                  onChangeTextbook={() => setPickerOpen(true)}
                />
                <ReviewCard
                  authLoading={authLoading}
                  signedOut={signedOut}
                  onSignIn={signIn}
                  loading={!!user && srsLoading}
                  summary={srs}
                />
              </div>

              {sidebarBelow && stats}

              <div>
                <SectionLabel label="More tools" />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 10,
                }}>
                  {SECONDARY_MODULES.map(mod => (
                    <ModuleCard key={mod.id} module={mod} disabled={signedOut && mod.requiresAuth} />
                  ))}
                </div>
              </div>
            </div>

            {!sidebarBelow && stats}
          </div>
        </div>

        <Footer />
      </main>

      <TextbookPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentId={textbookState?.textbook.id ?? null}
        onSelect={chooseTextbook}
        wordCountFor={wordCountFor}
      />
    </div>
  )
}

// ── Stats sidebar ─────────────────────────────────────────────────────────────

// Same three groups either way — `columns` only decides whether they stack in
// the right-hand rail or sit side by side in the strip under the cards.
function StatsPanel({ columns, textbookState, signedOut, srs, articlesRead, seriesTracked }) {
  return (
    <aside style={{
      display: columns > 1 ? 'grid' : 'flex',
      gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
      flexDirection: 'column',
      gap: SPACE_24,
      minWidth: 0,
    }}>
      <div>
        <SectionLabel label="Textbook" />
        {textbookState ? (
          <>
            <StatRow label="Chapters done" value={`${textbookState.doneCount} / ${textbookState.chapters.length}`} />
            <StatRow label="Words drilled" value={textbookState.wordsDrilled} />
            <StatRow label="Up next" value={textbookState.current?.drilled && textbookState.next ? textbookState.next.label : textbookState.current?.label ?? '—'} />
          </>
        ) : (
          <Muted>No textbook chosen yet.</Muted>
        )}
      </div>

      <div>
        <SectionLabel label="Reviews" />
        {signedOut ? (
          <Muted>Sign in to see review stats.</Muted>
        ) : srs && srs.totalCards > 0 ? (
          <>
            <div style={{ marginBottom: SPACE_12 }}>
              <DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: srs.distribution[s.key] ?? 0 }))} />
            </div>
            <StatRow label="Cards" value={srs.totalCards} />
            <StatRow label="Learned" value={srs.learned} />
            <StatRow label="Reviews done" value={srs.totalReviews} />
          </>
        ) : (
          <Muted>No cards yet.</Muted>
        )}
      </div>

      <div>
        <SectionLabel label="Reading" />
        <StatRow label="Articles read" value={articlesRead} />
        <StatRow label="Series tracked" value={seriesTracked} />
      </div>
    </aside>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE_12, padding: `${SPACE_4}px 0`, fontSize: FS_BASE }}>
      <span style={{ color: TEXT_MUTED }}>{label}</span>
      <span style={{ color: TEXT }}>{value}</span>
    </div>
  )
}

function Muted({ children }) {
  return <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{children}</div>
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const linkStyle = { color: 'rgba(232,232,232,0.55)', fontSize: 13, textDecoration: 'none' }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: SPACE_16, paddingTop: SPACE_24 }}>
      <a href="https://scallsen.ca" target="_blank" rel="noopener noreferrer" className="footer-link" style={linkStyle}>
        Developed by Simon Callsen
      </a>
      <span style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13 }}>·</span>
      <a href="https://github.com/scallsen/japanese-study" target="_blank" rel="noopener noreferrer" className="footer-link" style={linkStyle}>
        GitHub
      </a>
    </div>
  )
}
