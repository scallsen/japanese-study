import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import { MODULES } from '../data/modules.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Dev-only comparison of primary+secondary action pairings for the home
// page's PrimaryCard (src/pages/homeCards.jsx — NewCard's "View all",
// ReviewCard's "Manage decks"). Not linked from the dashboard, not wired
// into the real cards — reached at #/dev/secondary-button-lab. Same pattern
// as TrackedStatLabPage: local option components, not a built shared one.
//
// The two problems this is exploring (see the screenshot that prompted it):
//   1. `ActionsRow` stacks buttons vertically on mobile and stretches every
//      child to fullWidth. A `variant="ghost"` secondary has a transparent
//      resting background, so that stretched box is invisible — the padding
//      around "View all" just reads as dead space under the text, not as a
//      button.
//   2. Fixing (1) by giving it a visible resting/hover background collides
//      with a second, unrelated problem: touch browsers fire `:hover` on tap
//      and often don't clear it until the next tap elsewhere, so a
//      hover-triggered fill flashes or gets stuck instead of reading as
//      feedback.
// Each option below states which of the two it actually solves.
//
// `stacked` is an explicit prop here, not the real `useIsMobile()` hook
// `ActionsRow` uses — that hook reads the actual browser window width, so a
// lab meant to compare desktop/mobile side by side without resizing the
// window needs its own switch instead.

const BG = '#1E1E1E'
const VOCAB_MODULE = MODULES.find(m => m.id === 'school-vocab')
const SRS_MODULE = MODULES.find(m => m.id === 'vocab-srs')

const WIDTHS = [
  { key: 'desktop', width: 460, stacked: false, label: 'Desktop (460px, row)' },
  { key: 'mobile', width: 360, stacked: true, label: 'Mobile (360px, stacked)' },
]

// ── Shared layout bits ───────────────────────────────────────────────────

// Mirrors ActionsRow's own row/column flip, but driven by the explicit
// `stacked` prop above instead of useIsMobile().
function ActionsPreview({ stacked, children }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: stacked ? 'column' : 'row',
      flexWrap: stacked ? 'nowrap' : 'wrap',
      alignItems: stacked ? 'stretch' : 'center',
      gap: SPACE_8,
    }}>
      {children}
    </div>
  )
}

function CoverSwatch({ accent, glyph }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 8, flexShrink: 0,
      background: `${accent}22`, border: `1px solid ${accent}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22,
    }}>
      {glyph}
    </div>
  )
}

// The two real cards this pattern actually appears on — same title/subtitle
// text as the screenshot that raised this, so the comparison isn't abstract.
const FIXTURES = [
  { key: 'practice', module: VOCAB_MODULE, title: 'Coto Advanced 2', subtitle: '5 of 12 chapters', primaryLabel: 'Redo Week 2, Day 1', secondaryLabel: 'View all', glyph: '📘' },
  { key: 'review', module: SRS_MODULE, title: 'Reviews', subtitle: '33 due · 0 new · ~9 min', primaryLabel: 'Review 33 cards', secondaryLabel: 'Manage decks', glyph: '📱' },
]

function MockCard({ accent, title, subtitle, primaryLabel, secondaryLabel, glyph, stacked, SecondaryComponent, inlineSecondary }) {
  return (
    <ModuleThemeProvider accent={accent}>
      <Card padding={SPACE_24} style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE_16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT }}>{title}</div>
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: SPACE_4 }}>
              {subtitle}
              {inlineSecondary}
            </div>
          </div>
          <CoverSwatch accent={accent} glyph={glyph} />
        </div>
        <ActionsPreview stacked={stacked}>
          <Button size="lg" fullWidth={stacked} onClick={() => {}}>{primaryLabel}</Button>
          {SecondaryComponent && <SecondaryComponent label={secondaryLabel} stacked={stacked} />}
        </ActionsPreview>
      </Card>
    </ModuleThemeProvider>
  )
}

// ── Option 1 — baseline (current behavior) ──────────────────────────────
// variant="ghost" + ActionsRow's fullWidth-on-mobile. Reproduced exactly so
// the problem is visible here, not just described.
function BaselineSecondary({ label, stacked }) {
  const accent = useAccent()
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {}}
      style={{
        background: 'transparent', border: 'none', color: accent,
        fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1,
        padding: stacked ? `${SPACE_8}px ${SPACE_16}px` : `10px ${SPACE_24}px`,
        borderRadius: 6, cursor: 'pointer',
        width: stacked ? '100%' : undefined,
      }}
    >
      {label}
    </button>
  )
}

// ── Option 2 — shrink-wrapped text link ─────────────────────────────────
// No background at all, ever — the affordance is an underline. Wrapped in a
// justify-content div instead of being stretched, so there's no invisible
// full-width box to misread as space. Solves problem 1 outright (nothing to
// stretch) and sidesteps problem 2 (nothing fills, so a stuck hover has no
// visible effect to get stuck).
function LinkSecondary({ label, stacked }) {
  const accent = useAccent()
  return (
    <div style={{ display: 'flex', justifyContent: stacked ? 'center' : 'flex-start' }}>
      <button
        type="button"
        className="sbl-link"
        onClick={() => {}}
        style={{
          background: 'transparent', border: 'none', color: accent,
          fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1,
          padding: `${SPACE_8}px ${SPACE_4}px`, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  )
}

// ── Option 3 — shrink-wrapped ghost pill, tap-only fill ─────────────────
// Keeps the pill look (rounded, tinted-on-interaction) but stops stretching
// it — solves problem 1 the same way Option 2 does. Separately fixes problem
// 2 by gating the background fill to `@media (hover: hover)` (real
// mouse/trackpad only) and using :active for touch, so a tap gets a brief
// press flash instead of a hover fill that can get stuck.
function PillSecondary({ label, stacked }) {
  const accent = useAccent()
  return (
    <div style={{ display: 'flex', justifyContent: stacked ? 'center' : 'flex-start' }}>
      <button
        type="button"
        className="sbl-pill"
        onClick={() => {}}
        style={{
          background: 'transparent', border: 'none', color: accent,
          fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1,
          padding: `${SPACE_8}px ${SPACE_16}px`, borderRadius: 999, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  )
}

// ── Option 4 — bordered "quiet" button, still full width ────────────────
// Shipped: this is now the real Button variant="quiet" (src/components/
// Button.jsx + .btn-quiet in global.css), not a lab mock — kept here so it
// stays visible next to the alternatives it was chosen over. Keeps
// ActionsRow's current fullWidth-on-mobile stretch (so it still lines up
// edge-to-edge with the primary button above it, which the other options
// give up), but gives the resting state a visible 1px edge — the tap zone
// has a real boundary before any interaction, so the padding above/below
// the label reads as "inside a button" rather than as blank space.
function QuietSecondary({ label, stacked }) {
  return <Button variant="quiet" size="lg" fullWidth={stacked} onClick={() => {}}>{label}</Button>
}

// ── Option 5 — demoted out of the action row entirely ───────────────────
// Structural rather than a re-skin: the secondary action moves up into the
// subtitle line ("5 of 12 chapters · View all") on both breakpoints, so the
// action row only ever has the one primary CTA — same direction as the
// style guide's ActionBar rule that a screen should read one clearly
// primary action, not several competing ones. Removes problems 1 and 2 by
// removing the stacked-button pairing altogether, at the cost of the two
// cards' secondary actions no longer sharing a baseline with each other (or
// with the primary button) the way the current bottom-pinned row does.
function InlineSecondary({ label }) {
  const accent = useAccent()
  return (
    <>
      {' · '}
      <button
        type="button"
        className="sbl-inline-link"
        onClick={() => {}}
        style={{
          background: 'transparent', border: 'none', color: accent,
          fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, lineHeight: 1,
          padding: 0, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </>
  )
}

const OPTIONS = [
  {
    key: 'baseline',
    title: '1 — Baseline (current)',
    note: 'variant="ghost" + ActionsRow\'s fullWidth-on-mobile. Shown for comparison — this is what\'s live today. Narrow the real browser window and tap "View all" on a touchscreen to see problem 2; the dead space under the mobile column here is problem 1.',
    Secondary: BaselineSecondary,
  },
  {
    key: 'link',
    title: '2 — Shrink-wrapped text link',
    note: 'No background, ever — underline is the only affordance. Solves both problems by having nothing to stretch and nothing to get stuck filled. Reads the lightest of the five, which may be too quiet for an action some users need to find.',
    Secondary: LinkSecondary,
  },
  {
    key: 'pill',
    title: '3 — Shrink-wrapped pill, tap-only fill',
    note: 'Keeps the current pill affordance but stops stretching it, and moves the background fill from :hover to :active on touch (media-gated). Closest to today\'s look while fixing both problems.',
    Secondary: PillSecondary,
  },
  {
    key: 'quiet',
    title: '4 — Bordered "quiet" button, still full width — SHIPPED',
    note: 'Now the real Button variant="quiet". Keeps the full-width stack (so it still lines up under the primary button) but gives it a real edge at rest, so the tap zone reads as a button instead of blank space, with the fill gated to :active so touch never gets a stuck :hover. Live on the real NewCard/ReviewCard now.',
    Secondary: QuietSecondary,
  },
  {
    key: 'inline',
    title: '5 — Demoted into the subtitle line',
    note: 'Structural: moves the secondary action out of the action row and into the card\'s subtitle text on both breakpoints, so the row only ever holds the one primary CTA. Removes the pairing (and both problems) outright, at the cost of the current bottom-edge alignment across cards.',
    inline: true,
  },
]

export default function SecondaryButtonLabPage() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Secondary button' }]} />

      <main style={{ flex: 1, overflowY: 'auto', padding: SPACE_24 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Primary + secondary action — layout options</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_32 }}>
            Sketches only — not wired into the real <code>NewCard</code>/<code>ReviewCard</code>. Each option
            renders the same two fixture cards (the real &quot;View all&quot; and &quot;Manage decks&quot; pairings) at a fixed
            460px desktop width and a fixed 360px mobile width side by side, so both breakpoints are visible
            at once without resizing the window. The mobile column uses an explicit <code>stacked</code> flag
            rather than the real <code>useIsMobile()</code> hook, for the same reason.
          </div>

          {OPTIONS.map(opt => (
            <div key={opt.key} style={{ marginBottom: SPACE_32 }}>
              <SectionHeader title={opt.title} />
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, opacity: 0.8, maxWidth: 760, marginBottom: SPACE_16, lineHeight: 1.5 }}>
                {opt.note}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_32 }}>
                {WIDTHS.map(w => (
                  <div key={w.key} style={{ width: w.width }}>
                    <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_12 }}>{w.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
                      {FIXTURES.map(f => (
                        <MockCard
                          key={f.key}
                          accent={f.module.accent}
                          title={f.title}
                          subtitle={f.subtitle}
                          primaryLabel={f.primaryLabel}
                          secondaryLabel={f.secondaryLabel}
                          glyph={f.glyph}
                          stacked={w.stacked}
                          SecondaryComponent={opt.inline ? undefined : opt.Secondary}
                          inlineSecondary={opt.inline ? <InlineSecondary label={f.secondaryLabel} /> : null}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
