import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { MODULES } from '../data/modules.js'
import { TEXTBOOKS, COVER_GUTTER_FRACTION } from '../data/textbooks.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BADGE, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24,
} from '../data/theme.js'

// The home page's two big cards. They live here rather than inside
// DashboardPage so the dev lab at #/dev/home-cards can render every state
// side by side against the exact same components the real page uses — a
// copy in the lab would drift the moment either one is edited.

const VOCAB_MODULE = MODULES.find(m => m.id === 'school-vocab')
const SRS_MODULE = MODULES.find(m => m.id === 'vocab-srs')

const HAIRLINE = 'rgba(255,255,255,0.08)'

const COVER_SIZE = 104
// Pulling the cover's transparent gutter (see COVER_GUTTER_FRACTION) off the
// right margin sits the artwork's own edge against the card's padding instead
// of leaving a phantom 16px gap the eye reads as misalignment.
const COVER_GUTTER = COVER_GUTTER_FRACTION * COVER_SIZE
// Button's `sm` horizontal padding. Shifting the quiet link row left by it
// lines the first link's *text* up with the primary button's box edge below.
const GHOST_TEXT_INSET = 14

function navigate(hash) {
  window.location.hash = hash
}

// `actions` is pinned to the card's bottom edge so the two cards' primary
// buttons sit on the same line however much body content each one has;
// `children` is the body above it and takes the slack. `height: 100%` is
// deliberate, not incidental: it makes the two cards match heights because
// they're told to, rather than relying on the parent grid's default stretch
// staying that way.
export function PrimaryCard({ accent, title, subtitle, cover, progress, actions, children }) {
  // Stacked one-per-row, a card has no neighbour to line up with, so the
  // floor that keeps the pair squarish side by side would only add dead air.
  const isMobile = useIsMobile()
  return (
    <ModuleThemeProvider accent={accent}>
      <Card
        padding={SPACE_24}
        style={{
          display: 'flex', flexDirection: 'column', gap: SPACE_16,
          height: '100%', minHeight: isMobile ? 0 : 250,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE_16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT }}>{title}</div>
            {subtitle && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>{subtitle}</div>}
          </div>
          {cover}
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

// The pixel-art cover, doubling as the change-textbook affordance: hovering
// it reveals a link over the artwork (the reveal is `.textbook-cover` in
// global.css — a useState hover would double-invoke under StrictMode).
// Books with no art yet get a plain spine-and-cover placeholder, which is
// drawn to fill its box and so takes no gutter correction.
function TextbookCover({ icon, accent, onChangeTextbook }) {
  return (
    <button
      type="button"
      className="textbook-cover"
      onClick={onChangeTextbook}
      style={{
        position: 'relative',
        width: COVER_SIZE,
        height: COVER_SIZE,
        marginRight: icon ? -COVER_GUTTER : 0,
        flexShrink: 0,
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}
    >
      {icon ? (
        <img className="textbook-cover__art" src={icon} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      ) : (
        <div className="textbook-cover__art" style={{
          width: '100%', height: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${HAIRLINE}`,
          borderLeft: `6px solid ${accent}`,
          borderRadius: 4,
        }} />
      )}
      <span
        className="textbook-cover__label"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: icon ? COVER_GUTTER : 0,
          right: icon ? COVER_GUTTER : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${SPACE_4}px`,
          // No scrim — the artwork itself fades on hover (.textbook-cover__art
          // in global.css), which reads cleaner than a panel that can only ever
          // cover the artwork's own bounds and not the canvas around it.
          // A cover is only ~71px of artwork wide, so the label wraps to two
          // lines — FS_BADGE keeps those two lines comfortably inside it.
          fontSize: FS_BADGE,
          lineHeight: 1.35,
          color: accent,
          textDecoration: 'underline',
        }}
      >
        Change textbook
      </span>
    </button>
  )
}

// Slow drift of the covers on offer, for the card that has nothing of its
// own to show yet. The list is rendered twice and the track animates to
// -50%, so the loop is seamless; the animation itself is
// `.textbook-marquee__track` in global.css (keyframes can't be inline).
function TextbookCarousel() {
  // A personal book is one learner's own course material, so there is nobody
  // to advertise it to here — and the five of them share two covers between
  // them, which is what made this drift past as repeated N3 and N2 spines.
  const covers = TEXTBOOKS.filter(book => book.icon && !book.personal)
  const fade = 'linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)'
  return (
    <div
      className="textbook-marquee"
      style={{ overflow: 'hidden', maskImage: fade, WebkitMaskImage: fade }}
    >
      {/* Covers ride at their true size, and each one absorbs a gutter's worth
          of the next one's transparent margin so the artwork sits close
          together. Every item is treated identically, so the -50% loop still
          lands seamlessly. */}
      <div className="textbook-marquee__track" style={{ display: 'flex', gap: 0, width: 'max-content' }}>
        {[...covers, ...covers].map((book, i) => (
          <img
            key={`${book.id}-${i}`}
            src={book.icon}
            alt=""
            style={{
              width: COVER_SIZE,
              height: COVER_SIZE,
              marginRight: -COVER_GUTTER,
              flexShrink: 0,
              imageRendering: 'pixelated',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ButtonRow({ children, style }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center', ...style }}>{children}</div>
}

// The bottom-pinned block. Quiet links go above the primary row so the
// primary button is always the card's last element and lines up with the
// other card's, whichever branch either one is rendering.
function CardActions({ links, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
      {links && <ButtonRow style={{ marginLeft: -GHOST_TEXT_INSET }}>{links}</ButtonRow>}
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
        title="Practice"
        actions={<CardActions><Button size="lg" onClick={onChangeTextbook}>Choose textbook</Button></CardActions>}
      >
        <TextbookCarousel />
      </PrimaryCard>
    )
  }

  const { textbook, chapters, current, next, doneCount, hasWords } = state
  const complete = doneCount === chapters.length
  const cover = <TextbookCover icon={textbook.icon} accent={accent} onChangeTextbook={onChangeTextbook} />
  const viewAll = <Button variant="ghost" size="sm" onClick={() => navigate('#/vocab')}>View all chapters</Button>

  // A finished book's one useful next step is a different book, so the CTA
  // becomes that and the redundant "Change textbook" link drops away.
  if (complete) {
    return (
      <PrimaryCard
        accent={accent}
        title={textbook.title}
        subtitle="Book completed"
        cover={cover}
        progress={1}
        actions={
          <CardActions links={viewAll}>
            <Button size="lg" onClick={onChangeTextbook}>Pick new textbook</Button>
          </CardActions>
        }
      />
    )
  }

  return (
    <PrimaryCard
      accent={accent}
      title={textbook.title}
      subtitle={`${doneCount} of ${chapters.length} chapters`}
      cover={cover}
      progress={chapters.length ? doneCount / chapters.length : 0}
      actions={
        <CardActions links={viewAll}>
          {hasWords && (current.drilled && next ? (
            <>
              <Button size="lg" onClick={() => onStart(next)}>Start {next.label}</Button>
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
        title="Review"
        subtitle="Spaced repetition for the words you've studied. Sign in to sync your decks across devices."
        actions={<CardActions><Button size="lg" onClick={onSignIn}>Create account</Button></CardActions>}
      />
    )
  }

  if (!summary || summary.totalCards === 0) {
    return (
      <PrimaryCard
        accent={accent}
        title="Review"
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
