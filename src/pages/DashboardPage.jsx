import { useState } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import TextbookPicker from '../components/TextbookPicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
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
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION, FS_CONTENT_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24,
} from '../data/theme.js'

const VOCAB_MODULE = MODULES.find(m => m.id === 'school-vocab')
const SRS_MODULE = MODULES.find(m => m.id === 'vocab-srs')
const SECONDARY_MODULES = MODULES.filter(m => m.tier !== 'primary')

const HAIRLINE = 'rgba(255,255,255,0.08)'
const SIDEBAR_WIDTH = 280

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

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study' }]} rightSlot={<AuthSlot />}>
        {signedOut && (
          <div style={{
            background: 'rgba(37, 99, 235, 0.1)',
            borderTop: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '8px 24px',
            fontSize: FS_BASE,
            color: '#93C5FD',
          }}>
            New accounts are currently disabled. Most features are available without logging in!
          </div>
        )}
      </PageHeader>

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
            gridTemplateColumns: isMobile ? '1fr' : `minmax(0, 1fr) ${SIDEBAR_WIDTH}px`,
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

            <StatsSidebar
              textbookState={textbookState}
              signedOut={signedOut}
              srs={srs}
              articlesRead={Object.keys(immersionProgress?.read ?? {}).length}
              seriesTracked={Object.keys(animeTracking?.tracked ?? {}).length}
            />
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

// ── Primary cards ─────────────────────────────────────────────────────────────

function PrimaryCard({ accent, eyebrow, title, subtitle, icon, progress, children }) {
  return (
    <ModuleThemeProvider accent={accent}>
      <Card padding={SPACE_24} style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16, minHeight: 250 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE_16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS_BADGE, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {eyebrow}
            </div>
            <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginTop: SPACE_4 }}>{title}</div>
            {subtitle && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{subtitle}</div>}
          </div>
          {icon !== undefined && <IconSlot icon={icon} accent={accent} />}
        </div>

        {progress != null && (
          <div style={{ height: 4, borderRadius: 2, background: HAIRLINE, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: accent, transition: 'width 300ms ease' }} />
          </div>
        )}

        <div style={{ flex: 1 }} />
        {children}
      </Card>
    </ModuleThemeProvider>
  )
}

// The pixel-art textbook covers are 32×32 SVGs drawn with crispEdges; scaled
// up they must stay pixelated, not smoothed. Books without art yet (icon
// null) get a plain spine-and-cover placeholder in the module accent; cards
// with no icon at all (undefined) render no slot.
function IconSlot({ icon, accent }) {
  const size = 64
  if (icon) {
    return <img src={icon} alt="" style={{ width: size, height: size, flexShrink: 0, imageRendering: 'pixelated' }} />
  }
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${HAIRLINE}`,
      borderLeft: `6px solid ${accent}`,
      borderRadius: 4,
    }} />
  )
}

function ButtonRow({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>{children}</div>
}

function NewCard({ loading, state, onStart, onChangeTextbook }) {
  const accent = VOCAB_MODULE.accent

  if (loading) {
    return (
      <PrimaryCard accent={accent} eyebrow="New" title="Textbook">
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Loading…</div>
      </PrimaryCard>
    )
  }

  if (!state) {
    return (
      <PrimaryCard accent={accent} eyebrow="New" title="Pick a textbook" subtitle="One book at a time, at your own pace.">
        <ButtonRow>
          <Button size="lg" onClick={onChangeTextbook}>Choose textbook</Button>
        </ButtonRow>
      </PrimaryCard>
    )
  }

  const { textbook, chapters, current, next, doneCount, hasWords } = state
  const subtitle = `${doneCount} of ${chapters.length} chapters · ${textbook.subtitle}`

  return (
    <PrimaryCard
      accent={accent}
      eyebrow="New"
      title={textbook.title}
      subtitle={subtitle}
      icon={textbook.icon}
      progress={chapters.length ? doneCount / chapters.length : 0}
    >
      {!hasWords ? (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>No words for this book yet.</div>
      ) : (
        <ButtonRow>
          {current.drilled && next ? (
            <>
              <Button size="lg" onClick={() => onStart(next)}>Start {next.label}</Button>
              <Button size="lg" variant="neutral" onClick={() => onStart(current)}>Continue {current.label}</Button>
            </>
          ) : current.drilled ? (
            <>
              <Badge tone="success">Book complete</Badge>
              <Button size="lg" variant="neutral" onClick={() => onStart(current)}>Continue {current.label}</Button>
            </>
          ) : (
            <Button size="lg" onClick={() => onStart(current)}>Start {current.label}</Button>
          )}
        </ButtonRow>
      )}
      <ButtonRow>
        <Button variant="ghost" size="sm" onClick={() => navigate('#/vocab')}>View all chapters</Button>
        <Button variant="ghost-muted" size="sm" onClick={onChangeTextbook}>Change textbook</Button>
      </ButtonRow>
    </PrimaryCard>
  )
}

function ReviewCard({ authLoading, signedOut, onSignIn, loading, summary }) {
  const accent = SRS_MODULE.accent

  if (authLoading || loading) {
    return (
      <PrimaryCard accent={accent} eyebrow="Review" title="Reviews">
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Loading…</div>
      </PrimaryCard>
    )
  }

  if (signedOut) {
    return (
      <PrimaryCard accent={accent} eyebrow="Review" title="Reviews" subtitle="Spaced repetition for the words you've studied. Sign in to sync your decks across devices.">
        <ButtonRow>
          <Button size="lg" onClick={onSignIn}>Sign in with GitHub</Button>
        </ButtonRow>
      </PrimaryCard>
    )
  }

  if (!summary || summary.totalCards === 0) {
    return (
      <PrimaryCard accent={accent} eyebrow="Review" title="Reviews" subtitle="No cards yet. Finish a chapter and send its words here.">
        <ButtonRow>
          <Button variant="ghost" size="sm" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>
        </ButtonRow>
      </PrimaryCard>
    )
  }

  const { due, newToday, newWaiting, totalCards, activeDecks, canStart } = summary
  const caption = [
    `${activeDecks} active ${activeDecks === 1 ? 'deck' : 'decks'}`,
    `${totalCards} cards`,
    newWaiting > 0 ? `${newWaiting} new waiting` : null,
  ].filter(Boolean).join(' · ')

  return (
    <PrimaryCard accent={accent} eyebrow="Review" title="Reviews" subtitle={caption}>
      <div style={{ display: 'flex', gap: SPACE_24 }}>
        <Stat value={due} label="Due" />
        <Stat value={newToday} label="New today" />
      </div>
      <ButtonRow>
        <Button size="lg" disabled={!canStart} onClick={() => navigate('#/vocab-srs?start=1')}>
          {canStart ? 'Start reviews' : 'Nothing due'}
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button variant="ghost" size="sm" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>
      </ButtonRow>
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

// ── Stats sidebar ─────────────────────────────────────────────────────────────

function StatsSidebar({ textbookState, signedOut, srs, articlesRead, seriesTracked }) {
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24, minWidth: 0 }}>
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
