import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import ChipSelector from '../components/Chip.jsx'
import { useState } from 'react'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32, BRAND, LANTERN_ON,
} from '../data/theme.js'

// Dev-only, not linked from the dashboard — reached at #/dev/accent-polish.
// Two unrelated live-review findings, one page: (1) BRAND as small text was
// hard to read wherever Chip/Button/Badge render it — already fixed in the
// real components (Chip.jsx, Button.jsx, Badge.jsx all now swap to
// BRAND_TEXT for text specifically, keeping raw BRAND for borders/tints);
// this section is the before/after record, not a live decision. (2) the
// loading pulse (CenteredLoadingMessage) — liked the concept, wanted it
// smoother; this section is genuinely still open, comparing the shipped
// version against several others across timing/colour/intensity/mechanism.

/* ───────────────────────── Section 1: readability ───────────────────────── */

// Frozen recreation of Chip's pre-fix style (`color: accent` on the label,
// full-saturation BRAND) — the real component is already fixed, so this is
// what "before" looked like, not a second live option.
function LegacyChip({ label, active }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '4px 11px', borderRadius: 4, fontSize: FS_BASE,
      fontFamily: FONT, letterSpacing: TRACKING,
      background: active ? `${BRAND}22` : 'transparent',
      color: active ? BRAND : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}55` : 'rgba(255,255,255,0.12)'}`,
    }}>
      {label}
    </span>
  )
}

// Frozen recreation of Button's pre-fix accent-outline (`color: accent`).
function LegacyOutlineButton({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: `10px ${SPACE_24}px`, borderRadius: 6, fontSize: FS_BASE,
      fontFamily: FONT, letterSpacing: TRACKING,
      background: `${BRAND}29`, border: `1px solid ${BRAND}6b`, color: BRAND,
    }}>
      {children}
    </span>
  )
}

const CONTENT_OPTIONS = ['Anime', 'Drama', 'Movie', 'Novel', 'Non-fiction', 'Video game', 'Visual novel', 'Web novel', 'Manga', 'Audio']
const DIFFICULTY_OPTIONS = ['Beginner', 'Easy', 'Average', 'Hard', 'Expert', 'Insane']
const MATURITY_OPTIONS = ['Safe', 'Slightly suggestive', 'Suggestive']

function LegacyPanel() {
  return (
    <div style={{ background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: SPACE_16 }}>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Content</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, marginBottom: SPACE_16 }}>
        {CONTENT_OPTIONS.map((c, i) => <LegacyChip key={c} label={c} active={i === 0} />)}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Difficulty</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, marginBottom: SPACE_16 }}>
        {DIFFICULTY_OPTIONS.map(c => <LegacyChip key={c} label={c} active />)}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Maturity</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, marginBottom: SPACE_16 }}>
        {MATURITY_OPTIONS.map((c, i) => <LegacyChip key={c} label={c} active={i === 0} />)}
      </div>
      <LegacyOutlineButton>Start review (27)</LegacyOutlineButton>
    </div>
  )
}

function CurrentPanel() {
  const [content, setContent] = useState(new Set([CONTENT_OPTIONS[0]]))
  const [difficulty, setDifficulty] = useState(new Set(DIFFICULTY_OPTIONS))
  const [maturity, setMaturity] = useState(new Set([MATURITY_OPTIONS[0]]))
  const toOptions = arr => arr.map(v => ({ value: v, label: v }))
  return (
    <div style={{ background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: SPACE_16 }}>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Content</div>
      <div style={{ marginBottom: SPACE_16 }}>
        <ChipSelector mode="multi" options={toOptions(CONTENT_OPTIONS)} value={content} onChange={setContent} accent={BRAND} />
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Difficulty</div>
      <div style={{ marginBottom: SPACE_16 }}>
        <ChipSelector mode="multi" options={toOptions(DIFFICULTY_OPTIONS)} value={difficulty} onChange={setDifficulty} accent={BRAND} />
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_12 }}>Maturity</div>
      <div style={{ marginBottom: SPACE_16 }}>
        <ChipSelector mode="multi" options={toOptions(MATURITY_OPTIONS)} value={maturity} onChange={setMaturity} accent={BRAND} />
      </div>
      <Button variant="accent-outline" accent={BRAND}>Start review (27)</Button>
    </div>
  )
}

function ReadabilitySection() {
  return (
    <div style={{ marginBottom: SPACE_32, paddingBottom: SPACE_32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader title="1 — Accent-red text legibility (already fixed)" />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16 }}>
        Chip, Button&apos;s <code>accent-outline</code>/<code>ghost</code>, and Badge&apos;s <code>tone=&quot;accent&quot;</code> all
        used raw BRAND (<code>#FF004D</code>) as small text colour — exactly what brand/BRAND.md&apos;s own contrast note
        already flagged (&ldquo;BRAND_TEXT for … any red text under 24px&rdquo;), just not yet applied. Fixed at the
        component level: border and background tint stay on raw BRAND, only the label swaps to <code>BRAND_TEXT
        (#FF5C8A)</code> when the accent is BRAND specifically — other accent colours (ToggleButton&apos;s success/neutral
        tones, the segment-colour badges on the Browse page) are untouched.
      </div>
      <div style={{ display: 'flex', gap: SPACE_24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Before</div>
          <div style={{ width: 420 }}><LegacyPanel /></div>
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>After (live component)</div>
          <div style={{ width: 420 }}><CurrentPanel /></div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Section 2: loading pulse ───────────────────────── */

const PULSE_VARIANTS = [
  {
    id: 'flicker',
    label: 'v1 — Original: hard on/off flicker',
    note: 'Two full sprites, opacity toggled on a hard steps(1) cut. What the user was reacting to — liked the concept, wanted it smoother. Retired.',
    render: () => (
      <span style={{ position: 'relative', display: 'inline-block', width: 24, height: 24 }}>
        <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-flicker-on" style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated' }} />
        <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-flicker-off" style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated', filter: 'grayscale(1) brightness(0.5)' }} />
      </span>
    ),
  },
  {
    id: 'crossfade',
    label: 'v1.5 — Smooth crossfade, no glow',
    note: 'Same two-sprite crossfade, eased instead of stepped. Smoother than v1, but still reads as "switching," not glowing.',
    render: () => (
      <span style={{ position: 'relative', display: 'inline-block', width: 24, height: 24 }}>
        <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-crossfade-on" style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated' }} />
        <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-crossfade-off" style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated', filter: 'grayscale(1) brightness(0.5)' }} />
      </span>
    ),
  },
  {
    id: 'pulse',
    label: 'v2 — Shipped: breathe + soft EMBER glow',
    shipped: true,
    note: 'Single sprite, opacity breathing 1 → 0.45, synced soft drop-shadow glow in EMBER. No off-sprite needed. Reads as glowing, not switching.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-pulse" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'strong',
    label: 'Glow intensity — strong',
    note: 'Same breathe, glow radius/peak-opacity pushed up (5px/0.65 → 9px/0.9). More dramatic; risks feeling busy next to body text.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-strong" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'yellow',
    label: 'Glow colour — GLOW (yellow)',
    note: 'Same breathe/intensity as shipped, glow colour swapped from EMBER to GLOW — the window colour instead of its core.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-glow-yellow" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'red',
    label: 'Glow colour — BRAND (red)',
    note: 'Glow in the app\'s own accent instead of a lantern-internal colour. Ties the loading state to BRAND directly, at the cost of the warm "ember" feeling.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-glow-red" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'stepped',
    label: 'Timing — pixel/stepped, not smooth',
    note: 'Same breathe + glow, steps(4) instead of ease-in-out — a chunky, "retro" pulse in 4 discrete frames rather than a fully analog fade. Closer to the app\'s no-antialiasing pixel aesthetic; less "smooth" in the literal sense the ask was for.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-stepped" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'glow-only',
    label: 'Mechanism — glow-only, lamp stays lit',
    note: 'The sprite itself never dims — stays fully opaque — only the halo around it breathes. Reads as "steadily working, with a living aura" rather than "pulsing on and off." Arguably fits a loading state better: the thing being waited for is in progress, not intermittent.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-glow-only" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'pixel-glow',
    label: 'Glow style — hard-edged "pixel" glow',
    note: 'box-shadow with zero blur instead of filter: drop-shadow\'s gaussian blur — a crisp rectangular ring, stepped rather than eased, matching the sprite\'s own shape-rendering: crispEdges instead of a smooth photographic bloom.',
    render: () => (
      <span className="lantern-demo-pixel-glow-box" style={{ display: 'inline-block', borderRadius: 2 }}>
        <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pixel-glow-img" style={{ display: 'block', imageRendering: 'pixelated' }} />
      </span>
    ),
  },
]

function PulseCard({ variant }) {
  return (
    <div style={{
      background: '#2A2A2A', border: `1px solid ${variant.shipped ? `${BRAND}55` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 8, padding: SPACE_16, width: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE_12 }}>
        <div style={{ fontSize: FS_BASE, color: TEXT }}>{variant.label}</div>
        {variant.shipped && <Badge tone="success">Live now</Badge>}
      </div>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1E1E', borderRadius: 6, marginBottom: SPACE_12 }}>
        {variant.render()}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5 }}>{variant.note}</div>
    </div>
  )
}

function PulseSection() {
  return (
    <div>
      <SectionHeader title="2 — Loading pulse: smoother, and what else is possible" />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16 }}>
        &ldquo;Really like this loading state, how might we do this smoother?&rdquo; — the shipped answer (v2) is live in
        CenteredLoadingMessage now: a single sprite breathing in opacity with a synced soft glow, replacing the
        original two-sprite hard on/off flicker. The cards below vary timing, glow colour, glow intensity, and the
        underlying mechanism, so the shipped choice is a comparison, not a guess.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_16 }}>
        {PULSE_VARIANTS.map(v => <PulseCard key={v.id} variant={v} />)}
      </div>
    </div>
  )
}

export default function AccentPolishLabPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, color: TEXT }}>
      <PageHeader crumbs={[{ label: 'Lantern', href: '#/' }, { label: 'Accent polish' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: 28 }}>Accent polish — readability &amp; loading pulse</div>
          <ReadabilitySection />
          <PulseSection />
        </div>
      </main>
    </div>
  )
}
