import { useState, useRef, Children, cloneElement, isValidElement } from 'react'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Popover from '../components/Popover.jsx'
import Menu from '../components/Menu.jsx'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { TEXTBOOKS, COVER_GUTTER_FRACTION } from '../data/textbooks.js'
import { chapterPrimaryAction } from './chapterAction.jsx'
import { useCoverRotation } from './coverRotation.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BADGE, FS_BASE, FS_CONTENT_HEADING,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32, BRAND,
  LANTERN_ON_HERO, LANTERN_OFF_HERO,
} from '../data/theme.js'

// The home page's two big cards, plus SegmentedPrimary/ActionsRow/
// chapterPrimaryAction, which the vocab training page's own header reuses —
// they live here rather than inside DashboardPage so the dev lab at
// #/dev/home-cards can render every state side by side against the exact
// same components the real page uses, and so both pages show the same
// primary action for the chapter under the tracker.


const HAIRLINE = 'rgba(255,255,255,0.08)'

export const COVER_SIZE = 104

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
  return (
    <ModuleThemeProvider accent={accent}>
      <Card
        padding={SPACE_24}
        // Dropped the BRAND left edge from brand/BRAND.md §3.3 — visual
        // review call, kept out of that section now (see the note there).
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
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
        </div>
        {/* The one gap between content and actions — sized to the card's own
            padding so a card with nothing above the button still reads at
            the same rhythm as the card's outer edge, instead of stacking a
            flex `gap` on top of this floor (which is what "doubled" it). */}
        <div style={{ flex: 1, minHeight: SPACE_24 }} />
        {actions}
      </Card>
    </ModuleThemeProvider>
  )
}

// The pixel-art cover, cropped to its true bounds (the 5/32 transparent
// gutter each side is cut away, not just visually offset), doubling as the
// change-textbook affordance: hovering it reveals a link over the artwork
// (`.textbook-cover` in global.css — a useState hover would double-invoke
// under StrictMode). Books with no art yet get a plain spine-and-cover
// placeholder, which is drawn to fill its box and so takes no crop.
export function TextbookCover({ icon, accent, onChangeTextbook }) {
  const gutter = icon ? COVER_GUTTER_FRACTION * COVER_SIZE : 0
  const width = COVER_SIZE - gutter * 2
  return (
    <button
      type="button"
      className="textbook-cover"
      onClick={onChangeTextbook}
      style={{
        position: 'relative',
        width: icon ? width : COVER_SIZE,
        height: COVER_SIZE,
        flexShrink: 0,
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}
    >
      {icon ? (
        <img
          className="textbook-cover__art"
          src={icon}
          alt=""
          style={{ width: COVER_SIZE, height: COVER_SIZE, marginLeft: -gutter, imageRendering: 'pixelated', display: 'block' }}
        />
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
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${SPACE_4}px`,
          // No scrim — the artwork itself fades on hover (.textbook-cover__art
          // in global.css), which reads cleaner than a panel that can only ever
          // cover the artwork's own bounds and not the canvas around it.
          // A cropped cover is only ~71px wide, so the label wraps to two
          // lines — FS_BADGE keeps those two lines comfortably inside it.
          fontSize: FS_BADGE,
          lineHeight: 1.35,
          textAlign: 'center',
          color: accent,
          textDecoration: 'underline',
        }}
      >
        Change word list
      </span>
    </button>
  )
}

// Covers on offer, for the card that has nothing of its own to show yet —
// rotates through them one at a time inside the same top-right square every
// other cover art occupies (TextbookCover), instead of a
// full-width marquee, so the card's shape never changes across states.
// Explored side by side with fade/slide/flip alternatives at
// #/dev/cover-rotation before picking this one ("pop in and replace").
const ROTATING_COVERS = TEXTBOOKS.filter(book => book.icon && !book.personal)
const COVER_ROTATE_MS = 2600

// Same crop TextbookCover already uses (the 5/32-per-side transparent
// gutter trimmed off). The image itself must always render at its full
// natural square size — shrinking *its own* width to the cropped width
// (rather than the crop window's width) stretches it non-uniformly. The
// crop window does the clipping; the image never changes shape.
export function CroppedArt({ book, className, artWidth, artLeft, gutter }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: artLeft, width: artWidth, height: COVER_SIZE, overflow: 'hidden' }}>
      <img
        src={book.icon}
        alt=""
        className={className}
        style={{ width: COVER_SIZE, height: COVER_SIZE, marginLeft: -gutter, imageRendering: 'pixelated', display: 'block' }}
      />
    </div>
  )
}

// A fixed square that shows one cover at a time, cross-animating between
// them via enter/exit CSS classes (keyframes in global.css). `size` lets a
// caller magnify it for closer inspection without changing the crop math —
// scaling the whole subtree keeps the art proportioned identically at any
// size, real or magnified.
export function CoverSquare({ covers, current, outgoing, enterClass, exitClass, size = COVER_SIZE }) {
  const scale = size / COVER_SIZE
  const gutter = COVER_GUTTER_FRACTION * COVER_SIZE
  const artWidth = COVER_SIZE - gutter * 2
  // Right-aligned, not centered — the square is a fixed COVER_SIZE box (so
  // the rotation animation has a stable frame to play in), but the crop
  // itself should still sit flush with the card's right edge, matching
  // TextbookCover (whose box shrinks to the cropped width instead).
  const artLeft = COVER_SIZE - artWidth

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, overflow: 'hidden', perspective: 500 }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {outgoing && (
          <CroppedArt
            key={`out-${outgoing.cycleId}`}
            book={covers[outgoing.index]}
            className={exitClass}
            artWidth={artWidth}
            artLeft={artLeft}
            gutter={gutter}
          />
        )}
        <CroppedArt
          key={`in-${current}`}
          book={covers[current]}
          className={enterClass}
          artWidth={artWidth}
          artLeft={artLeft}
          gutter={gutter}
        />
      </div>
    </div>
  )
}

function RotatingCover() {
  const { current, outgoing } = useCoverRotation(ROTATING_COVERS.length, COVER_ROTATE_MS)
  return (
    <CoverSquare
      covers={ROTATING_COVERS}
      current={current}
      outgoing={outgoing}
      enterClass="cover-pop-enter"
      exitClass="cover-pop-exit"
    />
  )
}

// Only ever two buttons on a card: the (possibly segmented) primary, then
// one secondary action, side by side rather than a quiet link row above —
// except on mobile, where the stacked card is already full device width and
// a hug-content button next to it just reads as dead space. Below the
// breakpoint the row becomes a column and every child is stretched to fill
// it (`fullWidth` cloned onto each — both Button and SegmentedPrimary
// support it), same shape as a modal's stacked primary/secondary actions.
// Both keep the size they were given (`lg`, at every real call site) rather
// than shrinking the secondary to `md` — that used to be here to tighten a
// transparent `ghost` button's own dead-space padding, but the secondary is
// `variant="quiet"` now (a real bordered button, see Button.jsx), so
// shrinking it just made it a visibly different height from the primary
// above it for no reason.
export function ActionsRow({ children }) {
  const isMobile = useIsMobile()
  const items = isMobile
    ? Children.map(children, child => (
        isValidElement(child) ? cloneElement(child, { fullWidth: true }) : child
      ))
    : children
  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: isMobile ? 'nowrap' : 'wrap',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: SPACE_8,
    }}>
      {items}
    </div>
  )
}

// A main action plus, when there's a real alternative (redo the current
// chapter instead of advancing), a chevron that opens it in a popover menu
// rather than surfacing it as a second visible button. Degrades to a plain
// Button when there's nothing to put in the menu.
//
// Hand-rolled rather than two <Button variant="primary">s glued together —
// the shared square-height chevron segment and the seam between them don't
// map onto Button's API — so it needs Button.jsx's btn-primary class added
// explicitly (see global.css) to get the same BRAND_DEEP hover Button's own
// primary variant gets; it won't pick that up automatically from Button.jsx.
export function SegmentedPrimary({ size = 'lg', label, onClick, menuItems = [], fullWidth = false }) {
  const accent = useAccent()
  const [open, setOpen] = useState(false)
  const chevronRef = useRef(null)

  if (menuItems.length === 0) {
    return <Button size={size} onClick={onClick} fullWidth={fullWidth}>{label}</Button>
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
    <div style={{
      display: fullWidth ? 'flex' : 'inline-flex',
      width: fullWidth ? '100%' : undefined,
      flexShrink: fullWidth ? undefined : 0,
      alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <button
        type="button"
        className="btn btn-tint btn-primary"
        onClick={onClick}
        style={{
          background: accent, border: 'none', boxSizing: 'border-box',
          flex: fullWidth ? '1 1 auto' : '0 0 auto',
          whiteSpace: 'nowrap', textAlign: 'center',
          color: '#fff', padding: pad, fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1, cursor: 'pointer',
        }}
      >
        {label}
      </button>
      <button
        ref={chevronRef}
        type="button"
        className="btn btn-tint btn-primary"
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        style={{
          background: accent, border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', boxSizing: 'border-box', flexShrink: 0,
          color: '#fff', padding: 0, width: square, height: square, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, letterSpacing: TRACKING, fontSize: 20, lineHeight: 1, cursor: 'pointer',
        }}
      >
        <span style={{ display: 'block', transform: 'translateY(-2px)' }}>▾</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={chevronRef} align="end" width={200} bodyPadding={0}>
        <Menu items={menuItems} onSelect={id => { setOpen(false); menuItems.find(i => i.id === id)?.onClick() }} />
      </Popover>
    </div>
  )
}

export function NewCard({ loading, state, onStart, onAdvance, onChangeTextbook }) {
  const accent = BRAND

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
        subtitle="Drill words from your study materials"
        cover={<RotatingCover />}
        actions={<ActionsRow><Button size="lg" onClick={onChangeTextbook}>Choose word list</Button></ActionsRow>}
      />
    )
  }

  const { textbook, chapters, doneCount, hasWords } = state
  const complete = doneCount === chapters.length
  const cover = <TextbookCover icon={textbook.icon} accent={accent} onChangeTextbook={onChangeTextbook} />
  const viewChapters = <Button variant="quiet" size="lg" onClick={() => navigate('#/vocab')}>View all</Button>

  if (!hasWords) {
    return (
      <PrimaryCard
        accent={accent}
        title={textbook.title}
        subtitle={`${doneCount} of ${chapters.length} chapters`}
        cover={cover}
        actions={<ActionsRow>{viewChapters}</ActionsRow>}
      >
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>No words for this book yet.</div>
      </PrimaryCard>
    )
  }

  const { label, onClick, menuItems } = chapterPrimaryAction(state, { onStart, onAdvance, onChangeTextbook })

  return (
    <PrimaryCard
      accent={accent}
      title={textbook.title}
      subtitle={complete ? 'Book completed' : `${doneCount} of ${chapters.length} chapters`}
      cover={cover}
      actions={
        <ActionsRow>
          <SegmentedPrimary size="lg" label={label} onClick={onClick} menuItems={menuItems} />
          {viewChapters}
        </ActionsRow>
      }
    />
  )
}

// Lit when there's something to review, unlit when the queue is empty —
// brand/BRAND.md §2, §4. No dim/third state; static, it only animates via
// ReviewCard's own on↔off swap when its state changes (handled by React
// simply re-rendering a different <img src>, no crossfade). Full COVER_SIZE
// height now, matching NewCard's TextbookCover — the Reviews card gets a
// real illustration instead of a small badge, so it uses the higher-detail
// HERO pair rather than the small pair every other instance keeps using.
// Height-only, no fixed width: the sprite's viewBox is cropped to its true
// (non-square) bounds, so forcing a COVER_SIZE-square width would stretch
// it — auto width keeps it undistorted, and the card's own
// justify-content: space-between row (see PrimaryCard) is what pushes it
// flush against the card's right edge regardless of its narrower width.
function ReviewLamp({ on }) {
  return (
    <img
      src={on ? LANTERN_ON_HERO : LANTERN_OFF_HERO}
      alt=""
      height={COVER_SIZE}
      style={{ display: 'block', imageRendering: 'pixelated', flexShrink: 0 }}
    />
  )
}

export function ReviewCard({ authLoading, signedOut, onSignIn, loading, summary }) {
  const accent = BRAND

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
        subtitle="Long-term memorization for vocabulary"
        cover={<ReviewLamp on={false} />}
        // Weaker than Practice's "Choose word list" on purpose — this is the
        // optional card, not the primary action on the page.
        actions={<ActionsRow><Button size="lg" variant="neutral" onClick={onSignIn}>Create account</Button></ActionsRow>}
      />
    )
  }

  if (!summary || summary.totalCards === 0) {
    return (
      <PrimaryCard
        accent={accent}
        title="Review"
        subtitle="No cards yet. Finish a chapter and send its words here."
        cover={<ReviewLamp on={false} />}
        actions={<ActionsRow><Button size="lg" variant="neutral" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button></ActionsRow>}
      />
    )
  }

  const { due, newToday, canStart, estimatedMinutes } = summary
  const headline = canStart ? `${due} due · ${newToday} new · ~${estimatedMinutes} min` : 'Nothing due'

  return (
    <PrimaryCard
      accent={accent}
      title="Reviews"
      subtitle={headline}
      cover={<ReviewLamp on={canStart} />}
      actions={
        <ActionsRow>
          <Button size="lg" disabled={!canStart} onClick={() => navigate('#/vocab-srs?start=1')}>
            {canStart ? `Review ${due + newToday} cards` : 'Nothing due'}
          </Button>
          <Button variant="quiet" size="lg" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>
        </ActionsRow>
      }
    />
  )
}
