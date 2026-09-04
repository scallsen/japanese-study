import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { MODULES } from '../data/modules.js'
import {
  TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24,
} from '../data/theme.js'

// The home page's two big cards. They live here rather than inside
// DashboardPage so the dev lab at #/dev/home-cards can render every state
// side by side against the exact same components the real page uses — a
// copy in the lab would drift the moment either one is edited.

const VOCAB_MODULE = MODULES.find(m => m.id === 'school-vocab')
const SRS_MODULE = MODULES.find(m => m.id === 'vocab-srs')

const HAIRLINE = 'rgba(255,255,255,0.08)'

function navigate(hash) {
  window.location.hash = hash
}

// `actions` is pinned to the card's bottom edge so the two cards' primary
// buttons sit on the same line however much body content each one has;
// `children` is the body above it and takes the slack.
export function PrimaryCard({ accent, title, subtitle, icon, progress, actions, children }) {
  // Stacked one-per-row, a card has no neighbour to line up with, so the
  // floor that keeps the pair squarish side by side would only add dead air.
  const isMobile = useIsMobile()
  return (
    <ModuleThemeProvider accent={accent}>
      <Card padding={SPACE_24} style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16, minHeight: isMobile ? 0 : 250 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE_16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT }}>{title}</div>
            {subtitle && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{subtitle}</div>}
          </div>
          {icon !== undefined && <IconSlot icon={icon} accent={accent} />}
        </div>

        {progress != null && (
          <div style={{ height: 4, borderRadius: 2, background: HAIRLINE, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: accent, transition: 'width 300ms ease' }} />
          </div>
        )}

        {children}
        <div style={{ flex: 1, minHeight: SPACE_8 }} />
        {actions}
      </Card>
    </ModuleThemeProvider>
  )
}

// The pixel-art textbook covers are 32×32 SVGs drawn with crispEdges; scaled
// up they must stay pixelated, not smoothed. Books without art yet (icon
// null) get a plain spine-and-cover placeholder in the module accent; cards
// with no icon at all (undefined) render no slot.
function IconSlot({ icon, accent }) {
  const size = 104
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

// The bottom-pinned block. Quiet links go above the primary row so the
// primary button is always the card's last element and lines up with the
// other card's, whichever branch either one is rendering.
function CardActions({ links, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
      {links && <ButtonRow>{links}</ButtonRow>}
      {children && <ButtonRow>{children}</ButtonRow>}
    </div>
  )
}

export function NewCard({ loading, state, onStart, onChangeTextbook }) {
  const accent = VOCAB_MODULE.accent

  if (loading) {
    return (
      <PrimaryCard accent={accent} title="Textbook">
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Loading…</div>
      </PrimaryCard>
    )
  }

  if (!state) {
    return (
      <PrimaryCard
        accent={accent}
        title="Pick a textbook"
        subtitle="One book at a time, at your own pace."
        actions={<CardActions><Button size="lg" onClick={onChangeTextbook}>Choose textbook</Button></CardActions>}
      />
    )
  }

  const { textbook, chapters, current, next, doneCount, hasWords } = state
  const subtitle = `${doneCount} of ${chapters.length} chapters · ${textbook.subtitle}`

  return (
    <PrimaryCard
      accent={accent}
      title={textbook.title}
      subtitle={subtitle}
      icon={textbook.icon}
      progress={chapters.length ? doneCount / chapters.length : 0}
      actions={
        <CardActions
          links={
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('#/vocab')}>View all chapters</Button>
              <Button variant="ghost-muted" size="sm" onClick={onChangeTextbook}>Change textbook</Button>
            </>
          }
        >
          {hasWords && (current.drilled && next ? (
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
          ))}
        </CardActions>
      }
    >
      {!hasWords && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>No words for this book yet.</div>}
    </PrimaryCard>
  )
}

export function ReviewCard({ authLoading, signedOut, onSignIn, loading, summary }) {
  const accent = SRS_MODULE.accent

  if (authLoading || loading) {
    return (
      <PrimaryCard accent={accent} title="Reviews">
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Loading…</div>
      </PrimaryCard>
    )
  }

  if (signedOut) {
    return (
      <PrimaryCard
        accent={accent}
        title="Reviews"
        subtitle="Spaced repetition for the words you've studied. Sign in to sync your decks across devices."
        actions={<CardActions><Button size="lg" onClick={onSignIn}>Sign in with GitHub</Button></CardActions>}
      />
    )
  }

  if (!summary || summary.totalCards === 0) {
    return (
      <PrimaryCard
        accent={accent}
        title="Reviews"
        subtitle="No cards yet. Finish a chapter and send its words here."
        actions={
          <CardActions>
            <Button size="lg" variant="neutral" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>
          </CardActions>
        }
      />
    )
  }

  const { due, newToday, newWaiting, totalCards, activeDecks, canStart } = summary
  const caption = [
    `${activeDecks} active ${activeDecks === 1 ? 'deck' : 'decks'}`,
    `${totalCards} cards`,
    newWaiting > 0 ? `${newWaiting} new waiting` : null,
  ].filter(Boolean).join(' · ')

  return (
    <PrimaryCard
      accent={accent}
      title="Reviews"
      subtitle={caption}
      actions={
        <CardActions links={<Button variant="ghost" size="sm" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>}>
          <Button size="lg" disabled={!canStart} onClick={() => navigate('#/vocab-srs?start=1')}>
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
