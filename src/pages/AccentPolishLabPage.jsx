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

/* ─────────────────────── Section 2: chip style directions ─────────────────────── */

// Each variant is a function of `active` → style object, so one row can show
// a realistic mix of on/off chips rather than isolated all-on swatches — the
// legibility question is as much "can you tell these apart" as "can you read
// the label."
const STYLE_VARIANTS = [
  {
    id: 'current',
    label: 'Current — outlined, tinted background',
    shipped: true,
    style: active => ({
      background: active ? `${BRAND}22` : 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: `1px solid ${active ? `${BRAND}55` : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Shipped (Chip.jsx, post readability-fix). Border + soft tint + BRAND_TEXT label.',
  },
  {
    id: 'filled',
    label: 'Filled solid',
    style: active => ({
      background: active ? BRAND : 'transparent',
      color: active ? '#fff' : TEXT_MUTED,
      border: `1px solid ${active ? BRAND : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'Solid BRAND fill, white label — the most unambiguous contrast of any option here. But a filter row with several chips active at once (Difficulty routinely has 4-6) turns into several solid red blocks, working against BRAND.md\'s one-primary-action-per-screen restraint — it starts to compete with the actual primary button on the same screen.',
  },
  {
    id: 'soft-no-border',
    label: 'Soft fill, no border',
    style: active => ({
      background: active ? `${BRAND}35` : 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: '1px solid transparent',
    }),
    note: 'Stronger tint than shipped (0x35 vs 0x22), no border at all — quieter edges, the fill alone carries "selected." Loses a little definition against busy backgrounds without the border\'s hard edge.',
  },
  {
    id: 'bold-outline',
    label: 'Bold outline, no fill',
    style: active => ({
      background: 'transparent',
      color: active ? BRAND_TEXT : TEXT_MUTED,
      border: `2px solid ${active ? BRAND : 'rgba(255,255,255,0.12)'}`,
    }),
    note: 'No background tint — a thicker (2px) border alone marks "selected." Reads more like a real outline button per chip than a filter pill; the row as a whole feels heavier even with no fill.',
  },
  {
    id: 'dot',
    label: 'Neutral + indicator dot',
    style: () => ({ background: 'transparent', color: TEXT, border: '1px solid rgba(255,255,255,0.12)' }),
    dot: true,
    note: 'Text and background never touch BRAND at all — a small dot carries the "selected" signal instead, sidestepping the contrast question entirely. Costs scannability: which chips are on takes a beat longer to register than a colour change does.',
  },
  {
    id: 'underline',
    label: 'Underline, no box',
    style: active => ({
      background: 'transparent', color: active ? BRAND_TEXT : TEXT_MUTED, border: 'none',
      borderBottom: `2px solid ${active ? BRAND : 'transparent'}`, borderRadius: 0, paddingBottom: 2,
    }),
    note: 'No box at all — a tab-like underline. Reads well for a small, mutually-exclusive set (a single-select view toggle), less at home as a dense multi-select grid like Difficulty\'s six options — nothing marks the tap target when inactive.',
  },
]

function VariantChip({ label, active, variant }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px',
      borderRadius: variant.id === 'underline' ? 0 : 4,
      fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
      ...variant.style(active),
    }}>
      {label}
      {variant.dot && active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND, flexShrink: 0 }} />}
    </span>
  )
}

function VariantRow({ variant }) {
  return (
    <div style={{ marginBottom: SPACE_24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8, marginBottom: SPACE_8 }}>
        <div style={{ fontSize: FS_BASE, color: TEXT }}>{variant.label}</div>
        {variant.shipped && <Badge tone="success">Live now</Badge>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, marginBottom: SPACE_8 }}>
        {DIFFICULTY_OPTIONS.map((c, i) => <VariantChip key={c} label={c} active={i % 2 === 0} variant={variant} />)}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.5, maxWidth: 700 }}>{variant.note}</div>
    </div>
  )
}

function ChipStyleSection() {
  return (
    <div style={{ marginBottom: SPACE_32, paddingBottom: SPACE_32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader title="2 — Chip style directions" />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16 }}>
        Section 1 fixed the text colour without changing the recipe (outline + tint). These vary the recipe
        itself — fill weight, border weight, whether colour touches text at all — with a realistic mix of
        on/off chips per row rather than isolated swatches, since half the legibility question is telling
        selected and unselected apart at a glance, not just reading one label in isolation.
      </div>
      {STYLE_VARIANTS.map(v => <VariantRow key={v.id} variant={v} />)}
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
    label: 'v3 — Shipped: glow-only, lamp stays lit',
    shipped: true,
    note: 'The sprite itself never dims — stays fully opaque — only the halo around it breathes. Reads as "steadily working, with a living aura" rather than "pulsing between lit and unlit." Picked over v2 for exactly that reason.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-pulse" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'strong',
    label: 'Glow intensity — strong',
    note: 'Same glow-only mechanism, radius/peak-opacity pushed up (6px/0.75 → 9px/0.9). More dramatic; risks feeling busy next to body text.',
    render: () => <img src={LANTERN_ON} alt="" width={24} height={24} className="lantern-demo-pulse-strong" style={{ imageRendering: 'pixelated' }} />,
  },
  {
    id: 'yellow',
    label: 'Glow colour — GLOW (yellow)',
    note: 'Same glow-only mechanism/intensity as shipped, colour swapped from EMBER to GLOW — the window colour instead of its core.',
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
