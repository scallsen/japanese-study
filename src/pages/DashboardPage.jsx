import { useState, useEffect, useCallback } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import PageHeader from '../components/PageHeader.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import TextbookPicker from '../components/TextbookPicker.jsx'
import SrsGateDialog from '../components/SrsGateDialog.jsx'
import { NewCard, ReviewCard } from './homeCards.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { useTextbookAdvance } from '../hooks/useTextbookAdvance.js'
import { MODULES } from '../data/modules.js'
import { bundledWordCountFor } from '../data/wordData.js'
import { useCustomWordCounts } from '../hooks/useCustomWords.js'
import { resolveTextbookState } from '../lib/textbookProgress.js'
import { getTextbook } from '../data/textbooks.js'
import { migrateProgress } from '../modules/vocab-srs/migrate.js'
import { getGlobalStats, getStateDistribution, getTodaysQueue } from '../modules/vocab-srs/srs.js'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import { safeLocalStorageGet } from '../utils/storage.js'
import { localDateStr } from '../utils/date.js'
import { takePendingToast } from '../utils/pendingToast.js'
import { supabase } from '../lib/supabase.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE,
  SPACE_4, SPACE_12, SPACE_16, SPACE_24, BRAND,
} from '../data/theme.js'

const SECONDARY_MODULES = MODULES.filter(m => m.tier !== 'primary')
const VOCAB_ACCENT = BRAND

const SIDEBAR_WIDTH = 280
// Below this the right-hand sidebar would squeeze the two primary cards into
// tall, narrow slivers, so it moves under them as a full-width stats strip
// and the cards get their squarer proportions back.
//
// Kept under ~1046 on purpose: that's the window width where the Explore
// grid's own auto-fill (240px cards, 10px gap, inside the 1120px max-width
// content column, 28px page padding each side) first fits a 4th column.
// A breakpoint any higher leaves a band where the stacked layout is wide
// enough for 4 Explore cards across with no sidebar yet visible — exactly
// the "page gets wide but no sidebar" gap this number closes.
const SIDEBAR_BREAKPOINT = 1020

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
  const todayStr = localDateStr()
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
    distribution: getStateDistribution(cards, decks),
    canStart: due.length > 0 || newCards.length > 0 || rescheduled.length > 0,
    estimatedMinutes: global.estimatedMinutes,
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
  const { data: srsRaw, save: saveSrs, loading: srsLoading } = useProgress('vocab-srs')
  const { data: immersionProgress } = useProgress('immersion')
  const { data: animeTracking } = useProgress('anime-vocab-tracking')

  const [pickerOpen, setPickerOpen] = useState(false)

  // Stories aren't a useProgress namespace (they're rows in their own shared
  // `stories` table, see CLAUDE.md), so the sidebar's count is its own
  // head-only query rather than reusing StoryModule's list fetch.
  const [storiesGenerated, setStoriesGenerated] = useState(null)
  useEffect(() => {
    if (!user) { setStoriesGenerated(null); return }
    let cancelled = false
    supabase.from('stories').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count, error }) => {
        if (cancelled) return
        if (error) { console.error('[DashboardPage] stories count failed:', error); return }
        setStoriesGenerated(count ?? 0)
      })
    return () => { cancelled = true }
  }, [user])

  // Shows a toast handed over by a page that redirected here and then
  // unmounted — currently account deletion. Reading clears it, so StrictMode's
  // double-invoke shows it once.
  const { showToast } = useToast()
  useEffect(() => {
    const message = takePendingToast()
    if (message) showToast({ message })
  }, [showToast])

  // A learner's own chapters are counted from their account rather than the
  // bundle; everything else still comes from the bundled lists.
  const customCounts = useCustomWordCounts()
  const wordCountFor = useCallback(
    id => bundledWordCountFor(id) || (customCounts[id] ?? 0),
    [customCounts],
  )
  const textbookState = vocabLoading ? null : resolveTextbookState(vocabProgress, wordCountFor)
  const srs = user && !srsLoading && srsRaw ? summariseSrs(srsRaw) : null

  const { gate, unsentWords, requestAdvance, skipGate, sendAndAdvance, closeGate } = useTextbookAdvance({
    state: textbookState,
    vocabProgress,
    saveVocabProgress,
    srsData: srsRaw,
    saveSrs,
  })

  // Pins the pointer to the book's first chapter rather than leaving it null:
  // resolveTextbookState falls back to "first undrilled chapter" for a null
  // pointer, and without an explicit pin here that fallback would silently
  // re-derive "current" as soon as chapter one is drilled — the null pointer
  // never gets an entry to be gated on, so the advance dialog never fires for
  // a freshly-chosen book's first chapter.
  function chooseTextbook(id) {
    saveVocabProgress({ ...(vocabProgress ?? {}), textbook: { id, currentChapterId: getTextbook(id)?.chapters[0]?.id ?? null } })
  }

  // The tracker itself never moves from starting a drill — only from
  // advanceChapter's deliberate, gated step below — so this just navigates.
  function startChapter(chapter) {
    navigate(`#/vocab?chapter=${encodeURIComponent(chapter.id)}&start=1`)
  }

  function advanceChapter() {
    const next = textbookState?.next
    if (!next) return
    requestAdvance(next, () => navigate(`#/vocab?chapter=${encodeURIComponent(next.id)}&start=1`))
  }

  const stats = (
    <StatsPanel
      columns={sidebarBelow && !isMobile ? 3 : 1}
      signedOut={signedOut}
      srs={srs}
      articlesRead={Object.keys(immersionProgress?.read ?? {}).length}
      seriesTracked={Object.keys(animeTracking?.tracked ?? {}).length}
      storiesGenerated={storiesGenerated}
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
      <PageHeader
        crumbs={[{ label: 'Lantern' }]}
        rightSlot={<AuthSlot />}
        // Home page only — every other page uses the crumb row purely for
        // navigation, and there's no room for this next to it on mobile.
        subtitle={isMobile ? null : 'Drill and memorize Japanese vocabulary'}
      />

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
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                gap: SPACE_12,
                // Same auto-rows-1fr trick as the Explore grid below: on desktop
                // the two cards already share one row (default stretch handles
                // it), but on mobile they're stacked into two separate rows —
                // without this each row would size to its own card's content
                // and the shorter card wouldn't match the taller one.
                gridAutoRows: '1fr',
              }}>
                <NewCard
                  loading={vocabLoading}
                  state={textbookState}
                  onStart={startChapter}
                  onAdvance={advanceChapter}
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
                <SectionHeader title="Explore" />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
                  // 1fr rows on an intrinsically-sized grid resolve to the
                  // tallest row's own height, applied to every row — the
                  // standard trick for equal-height cards across wrapped
                  // rows. Grid's default per-row stretch already does this
                  // within a single row; this is what's needed once a row
                  // only has one card in it (the single-column mobile stack)
                  // and there's no neighbour in that row to stretch against.
                  gridAutoRows: '1fr',
                  gap: 10,
                }}>
                  {SECONDARY_MODULES.map(mod => (
                    <ModuleCard key={mod.id} module={mod} disabled={signedOut && mod.requiresAuth} />
                  ))}
                </div>
              </div>

              {/* Stacked (collapsed sidebar) layout only — on the side, the
                  sidebar stays where it is, in its own grid column below.
                  Signed out, it's dropped here entirely rather than shown
                  dimmed: a dormant stats block at the bottom of a narrow
                  page reads as dead weight, not a sign-in nudge, once
                  there's no room for it beside the cards. Signed in, or on
                  the wide side-rail layout, nothing changes. */}
              {sidebarBelow && !signedOut && stats}
            </div>

            {!sidebarBelow && stats}
          </div>
        </div>

        <Footer />
      </main>

      {/* The picker and the advance gate are both opened from the New card, so
          they wear that card's accent rather than the dashboard's ambient
          core teal. */}
      <ModuleThemeProvider accent={VOCAB_ACCENT}>
        <TextbookPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          currentId={textbookState?.textbook.id ?? null}
          onSelect={chooseTextbook}
          wordCountFor={wordCountFor}
        />
        <SrsGateDialog
          gate={gate}
          chapterLabel={textbookState?.current?.label}
          unsentCount={unsentWords.length}
          totalCount={textbookState?.current?.wordCount}
          onCancel={closeGate}
          onSkip={skipGate}
          onSend={sendAndAdvance}
          isMobile={isMobile}
        />
      </ModuleThemeProvider>
    </div>
  )
}

// ── Stats sidebar ─────────────────────────────────────────────────────────────

// Same two groups either way — `columns` only decides whether they stack in
// the right-hand rail or sit side by side in the strip under the cards.
//
// Signed-out is the only state that dims the whole block (a real signed-in
// learner with zero cards still has real Stats data worth showing at full
// strength — only "–" placeholders there, not the dormant treatment).
// Reuses ModuleCard's existing disabled opacity rather than inventing a
// second "dormant" visual language (grayscale/desaturation has no precedent
// anywhere else in the app).
function StatsPanel({ columns, signedOut, srs, articlesRead, seriesTracked, storiesGenerated }) {
  const hasVocabData = !signedOut && srs && srs.totalCards > 0

  return (
    <aside style={{
      display: columns > 1 ? 'grid' : 'flex',
      gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
      flexDirection: 'column',
      gap: SPACE_24,
      minWidth: 0,
      opacity: signedOut ? 0.45 : 1,
    }}>
      <div>
        <SectionHeader title="Vocabulary" />
        {hasVocabData ? (
          <>
            <div style={{ marginBottom: SPACE_12 }}>
              <DistributionBar segments={STATE_SEGMENTS.map(s => ({ ...s, count: srs.distribution[s.key] ?? 0 }))} />
            </div>
            <StatRow label="Cards" value={srs.totalCards} />
            <StatRow label="Learned" value={srs.learned} />
          </>
        ) : (
          <>
            <StatRow label="Cards" value="–" />
            <StatRow label="Learned" value="–" />
          </>
        )}
      </div>

      <div>
        <SectionHeader title="Stats" />
        <StatRow label="Articles read" value={signedOut ? '–' : articlesRead} />
        <StatRow label="Series tracked" value={signedOut ? '–' : seriesTracked} />
        <StatRow label="Stories generated" value={signedOut ? '–' : (storiesGenerated ?? '–')} />
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

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const linkStyle = { color: 'rgba(232,232,232,0.55)', fontSize: 13, textDecoration: 'none' }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: SPACE_16, paddingTop: SPACE_24 }}>
      <a href="https://scallsen.ca" target="_blank" rel="noopener noreferrer" className="footer-link" style={linkStyle}>
        Developed by Simon Callsen
      </a>
      <span style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13 }}>·</span>
      <a href="https://github.com/scallsen/lantern" target="_blank" rel="noopener noreferrer" className="footer-link" style={linkStyle}>
        GitHub
      </a>
      <span style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13 }}>·</span>
      <a href="#/privacy" className="footer-link" style={linkStyle}>
        Privacy Policy
      </a>
    </div>
  )
}
