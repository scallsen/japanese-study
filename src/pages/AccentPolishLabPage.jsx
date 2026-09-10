import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import ChipSelector from '../components/Chip.jsx'
import { useState } from 'react'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32, BRAND, BRAND_TEXT, LANTERN_ON,
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

/* ─────────────────────── Section 2: chip colour tuning ─────────────────────── */

// Structural alternatives (filled solid, no-border soft fill, bold outline,
// indicator dot, underline) were tried first and rejected outright — none of
// them, kept here as a one-line record, not full cards. These stay on the
// shipped recipe (outline + tint + coloured label) and only tune the two
// numbers in it: background tint darkness and label lightness.
const REJECTED_DIRECTIONS = [
  'Filled solid (white label on solid BRAND)',
  'Soft fill with no border',
  'Bold 2px outline with no fill',
  'Neutral text/background + a small indicator dot',
  'Tab-style underline with no box',
]

const WHITER = '#FFA8C4' // lighter than BRAND_TEXT, still pink — not full white

// Each variant is a function of `active` → style object, so one row can show
// a realistic mix of on/off chips rather than isolated all-on swatches.
const TUNING_VARIANTS = [
  {
    id: 'current',
    label: 'Current — bg 13%, BRAND_TEXT label',
    shipped: true,
    style: active => ({
      background: active ? `${BRAND}22` : 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}55` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Shipped (Chip.jsx, post readability-fix).',
  },
  {
    id: 'darker-bg',
    label: 'Darker bg (19%), same label colour',
    style: active => ({
      background: active ? `${BRAND}30` : 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}60` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Just the background pushed darker (0x22 → 0x30), label and border otherwise unchanged. A richer chip at rest, no change to the text itself.',
  },
  {
    id: 'darker-bg-2',
    label: 'Darker still (24%), same label colour',
    style: active => ({
      background: active ? `${BRAND}3d` : 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}70` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'One step further (0x3d). Starting to read as a soft fill rather than a tint; label is BRAND_TEXT throughout, unchanged — worth checking whether it still separates cleanly from a background this saturated.',
  },
  {
    id: 'darker-bg-white',
    label: 'Darker bg (19%) + near-white label',
    style: active => ({
      background: active ? `${BRAND}30` : 'transparent',
      color: active ? TEXT : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}60` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Same darker background as the row above, label swapped from BRAND_TEXT to TEXT (#E8E8E8, the app\'s standard near-white) — as the tint darkens, the effective backdrop behind the label gets richer, the same reasoning that justifies white on the solid primary button.',
  },
  {
    id: 'darker-bg-2-white',
    label: 'Darker still (24%) + pure white label',
    style: active => ({
      background: active ? `${BRAND}3d` : 'transparent',
      color: active ? '#fff' : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}80` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Darkest background here, paired with pure white — closest to a soft-filled chip without going fully solid. Probably the strongest contrast of the set.',
  },
  {
    id: 'same-bg-whiter-text',
    label: 'Same bg (13%) + lighter pink label',
    style: active => ({
      background: active ? `${BRAND}22` : 'transparent',
      color: active ? WHITER : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}55` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Background untouched — only the label lightened, from BRAND_TEXT (#FF5C8A) to a paler pink (#FFA8C4), stopping short of full white so it still reads as "red," just lighter.',
  },
]

function TuningChip({ label, active, variant }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '4px 11px', borderRadius: 4,
      fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
      ...variant.style(active),
    }}>
      {label}
    </span>
  )
}

function TuningRow({ variant }) {
  return (
    <div style={{ marginBottom: SPACE_24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8, marginBottom: SPACE_8 }}>
        <div style={{ fontSize: FS_BASE, color: TEXT }}>{variant.label}</div>
        {variant.shipped && <Badge tone="success">Live now</Badge>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, marginBottom: SPACE_8 }}>
        {DIFFICULTY_OPTIONS.map((c, i) => <TuningChip key={c} label={c} active={i % 2 === 0} variant={variant} />)}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5, maxWidth: 700 }}>{variant.note}</div>
    </div>
  )
}

function ChipStyleSection() {
  return (
    <div style={{ marginBottom: SPACE_32, paddingBottom: SPACE_32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader title="2 — Chip colour tuning" />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_12 }}>
        Structural alternatives to the outline+tint recipe were rejected outright — kept here as a one-line
        record, not full cards: {REJECTED_DIRECTIONS.join('; ')}. These stay on the shipped recipe and only tune
        its two numbers — background tint darkness, label lightness — mixed on/off chips per row so telling
        selected apart from unselected at a glance stays part of the comparison.
      </div>
      {TUNING_VARIANTS.map(v => <TuningRow key={v.id} variant={v} />)}
    </div>
  )
}

/* ───────────────────────── Section 3: loading pulse ───────────────────────── */

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
    id: 'breathe',
    label: 'v2 — Retired: breathe + soft EMBER glow',
    note: 'Single sprite, opacity breathing 1 → 0.45, synced soft drop-shadow glow in EMBER. Shipped briefly, then replaced by glow-only below — dimming the lamp itself read as "flickering," the glow-only mechanism read as "steadily working."',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-breathe" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'glow-only',
    label: 'v3 — Shipped: glow-only, BRAND (red)',
    shipped: true,
    note: 'The sprite itself never dims — stays fully opaque — only the halo around it breathes, in the app\'s own accent colour. Reads as "steadily working, with a living aura." Glow colour swapped from EMBER (the lantern\'s own window-core) to BRAND after a live-review pass — see the EMBER card below for the original.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-pulse" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'strong',
    label: 'Glow intensity — strong',
    note: 'Same glow-only mechanism/colour as shipped, radius/peak-opacity pushed up (6px/0.75 → 9px/0.9). More dramatic; risks feeling busy next to body text.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-strong" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'ember',
    label: 'Glow colour — EMBER (the original)',
    note: 'What shipped first — the lantern\'s own window-core colour instead of BRAND. Warmer, ties to the sprite itself rather than the app accent; swapped out for BRAND to tie the loading state to the brand directly.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-glow-ember" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'yellow',
    label: 'Glow colour — GLOW (yellow)',
    note: 'Same glow-only mechanism/intensity as shipped, colour swapped to GLOW — the window colour itself, rather than its core (EMBER) or the app accent (BRAND).',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-glow-yellow" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'stepped',
    label: 'Timing — pixel/stepped, not smooth',
    note: 'v2\'s breathe + glow, steps(4) instead of ease-in-out — a chunky, "retro" pulse in 4 discrete frames rather than a fully analog fade. Closer to the app\'s no-antialiasing pixel aesthetic; less "smooth" in the literal sense the ask was for.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-stepped" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'pixel-glow',
    label: 'Glow style — hard-edged "pixel" glow',
    note: 'box-shadow with zero blur instead of filter: drop-shadow\'s gaussian blur — a crisp rectangular ring, stepped rather than eased, matching the sprite\'s own shape-rendering: crispEdges instead of a smooth photographic bloom. Sprite itself is static; only the ring pulses.',
    render: () => (
      <span className="lantern-demo-pixel-glow-box" style={{ display: 'inline-block', borderRadius: 2 }}>
        <img src={LANTERN_ON} alt="" width={24} height={24} style={{ display: 'block', imageRendering: 'pixelated' }} />
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
      <SectionHeader title="3 — Loading pulse: smoother, and what else is possible" />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16 }}>
        &ldquo;Really like this loading state, how might we do this smoother?&rdquo; — landed on glow-only (v3): the
        sprite itself stays fully lit and opaque, only a soft halo around it breathes, live in CenteredLoadingMessage
        now. Beat both the original two-sprite hard on/off flicker and an intermediate breathe+glow version (v2,
        below) that still dimmed the lamp itself. The remaining cards vary glow colour, intensity, and style against
        the shipped mechanism.
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
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: 28 }}>Accent polish — readability, chip style &amp; loading pulse</div>
          <ReadabilitySection />
          <ChipStyleSection />
          <PulseSection />
        </div>
      </main>
    </div>
  )
}
