import { useState, useRef } from 'react'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Popover from '../components/Popover.jsx'
import Menu from '../components/Menu.jsx'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { MODULES } from '../data/modules.js'
import { TEXTBOOKS, COVER_GUTTER_FRACTION } from '../data/textbooks.js'
import { chapterPrimaryAction } from './chapterAction.jsx'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BADGE, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// The home page's two big cards, plus SegmentedPrimary/ActionsRow/
// chapterPrimaryAction, which the vocab training page's own header reuses —
// they live here rather than inside DashboardPage so the dev lab at
// #/dev/home-cards can render every state side by side against the exact
// same components the real page uses, and so both pages show the same
// primary action for the chapter under the tracker.

const VOCAB_MODULE = MODULES.find(m => m.id === 'school-vocab')
const SRS_MODULE = MODULES.find(m => m.id === 'vocab-srs')

const HAIRLINE = 'rgba(255,255,255,0.08)'

const COVER_SIZE = 104

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
              marginRight: -(COVER_GUTTER_FRACTION * COVER_SIZE),
              flexShrink: 0,
              imageRendering: 'pixelated',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Only ever two buttons on a card: the (possibly segmented) primary, then
// one secondary action, side by side rather than a quiet link row above.
export function ActionsRow({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>{children}</div>
}

// A main action plus, when there's a real alternative (redo the current
// chapter instead of advancing), a chevron that opens it in a popover menu
// rather than surfacing it as a second visible button. Degrades to a plain
// Button when there's nothing to put in the menu.
export function SegmentedPrimary({ size = 'lg', label, onClick, menuItems = [] }) {
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
        actions={<ActionsRow><Button size="lg" onClick={onChangeTextbook}>Choose textbook</Button></ActionsRow>}
      >
        <TextbookCarousel />
      </PrimaryCard>
    )
  }

  const { textbook, chapters, doneCount, hasWords } = state
  const complete = doneCount === chapters.length
  const cover = <TextbookCover icon={textbook.icon} accent={accent} onChangeTextbook={onChangeTextbook} />
  const viewChapters = <Button variant="ghost" size="lg" onClick={() => navigate('#/vocab')}>View all</Button>

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

  const { label, onClick, menuItems, body } = chapterPrimaryAction(state, { onStart, onAdvance, onChangeTextbook })

  return (
    <PrimaryCard
      accent={accent}
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
      {body}
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
        actions={<ActionsRow><Button size="lg" onClick={onSignIn}>Create account</Button></ActionsRow>}
      />
    )
  }

  if (!summary || summary.totalCards === 0) {
    return (
      <PrimaryCard
        accent={accent}
        title="Review"
        subtitle="No cards yet. Finish a chapter and send its words here."
        actions={<ActionsRow><Button size="lg" variant="neutral" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button></ActionsRow>}
      />
    )
  }

  const { due, newToday, activeDecks, canStart, estimatedMinutes } = summary
  const headline = canStart ? `${due} due · ${newToday} new · ~${estimatedMinutes} min` : 'Nothing due'
  const caption = `${activeDecks} active ${activeDecks === 1 ? 'deck' : 'decks'}`

  return (
    <PrimaryCard
      accent={accent}
      title="Reviews"
      subtitle={headline}
      actions={
        <ActionsRow>
          <Button size="lg" disabled={!canStart} onClick={() => navigate('#/vocab-srs?start=1')}>
            {canStart ? `Review ${due + newToday} cards` : 'Nothing due'}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('#/vocab-srs')}>Manage decks</Button>
        </ActionsRow>
      }
    >
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{caption}</div>
    </PrimaryCard>
  )
}
