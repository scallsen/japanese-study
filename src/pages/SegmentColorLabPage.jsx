import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Badge from '../components/Badge.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32, BRAND, BRAND_TEXT,
  SEGMENT_COLORS, ACCENT_SECONDARY_DIM, EMBER, GLOW, CAP,
} from '../data/theme.js'

// Dev-only exploration, not linked from the dashboard — reached at
// #/dev/segment-colors. DistributionBar takes an optional `colors` prop
// (defaulting to SEGMENT_COLORS) purely so this page can drive the real
// component with candidate palettes — production call sites never pass it.
// Same "real components, fake data" convention as
// CoverRotationLabPage/TextbookPickerLabPage.
//
// History: this page originally compared five directions (current teal,
// brand-forward red, refined teal, warm amber, cool blue) for whether
// SEGMENT_COLORS should touch BRAND at all. The amber direction won —
// specifically, built from the lantern's own glow colours (EMBER/GLOW,
// both real PICO-8 palette entries, same discipline BRAND follows) rather
// than an arbitrary amber. See theme.js's ACCENT_SECONDARY comment block.
// The three sections below are that follow-up: EMBER alone, GLOW alone, or
// blended — the blend shipped, kept live here via the real SEGMENT_COLORS
// import rather than a duplicated literal, so this page can't drift from
// what's actually running. CVD note: none of this has been through an
// actual simulator (none available in this environment) — get an honest
// pass on whichever combination stays before leaning on it for
// accessibility, the same caveat the pre-rebrand ramp's own validation
// note implies.

const SAMPLE_COUNTS = { new: 8, learning: 5, young: 12, mature: 34, relearning: 3 }
const SAMPLE_SUSPENDED = 2
const SAMPLE_TOTAL = Object.values(SAMPLE_COUNTS).reduce((a, b) => a + b, 0) + SAMPLE_SUSPENDED

function segmentsFor(counts) {
  return STATE_SEGMENTS.map(s => ({ ...s, count: counts[s.key] ?? 0 }))
}

// The three amber directions actually asked for. All three keep `new` (CAP)
// and `relearning` (BRAND_TEXT) fixed — those aren't part of what's being
// compared — so the only real variable is the learning → young → mature run.
const AMBER_VARIANTS = [
  {
    id: 'blend',
    label: '1 — Blended: EMBER → GLOW (shipped)',
    shipped: true,
    colors: SEGMENT_COLORS,
    note: 'The lantern\'s own two window colours used as-is at the two most-legible ordinal steps — EMBER at "young", GLOW at "mature" — plus one more real PICO-8 colour (4, brown) for "learning". Every colour here is a genuine PICO-8 palette entry except BRAND_TEXT on relearning (already an established, contrast-checked token). Reads as "this card gets brighter as it\'s learned," the same way the lantern lights up.',
  },
  {
    id: 'ember-only',
    label: '2 — EMBER only (single hue)',
    colors: { new: CAP, learning: ACCENT_SECONDARY_DIM, young: EMBER, mature: '#FFCCAA', relearning: BRAND_TEXT },
    note: 'A pure lightness ramp inside EMBER\'s own hue (~38°): PICO-8 4 (brown) → EMBER → PICO-8 15 (peach, the lightest warm entry in the palette). Still fully PICO-8-sourced, but GLOW never appears — the ramp never actually reaches the lantern\'s brightest state, which undercuts the "gets brighter" narrative at its most important step (mature).',
  },
  {
    id: 'glow-only',
    label: '3 — GLOW only (single hue)',
    colors: { new: CAP, learning: '#6B5A0E', young: '#C9A83A', mature: GLOW, relearning: BRAND_TEXT },
    note: 'A pure lightness ramp inside GLOW\'s own hue (~55°, yellow-gold): dark olive → mid gold → GLOW. The one option here that breaks PICO-8 discipline — the palette has no second real yellow, so "learning" and "young" are interpolated, not sourced. Reaches full GLOW at "mature", but never touches EMBER, so the ramp skips the ember stage the lantern narrative implies.',
  },
]

// Condensed record of the directions considered before the amber call —
// swatches only, not full dual mockups, since they're not live candidates.
const RETIRED = [
  {
    label: 'Retired — teal-green (pre-rebrand)',
    colors: { new: '#aaaaaa', learning: '#4c8a7d', young: '#5eb6a2', mature: '#7fe0c8', relearning: '#e0a72e' },
    note: 'What SEGMENT_COLORS was before this page existed. Documented as CVD-validated at the time. No BRAND anywhere in it.',
  },
  {
    label: 'Considered — brand-forward (monochrome red)',
    colors: { new: '#6b6b6b', learning: '#FFD9E4', young: '#FF8FAE', mature: '#FF004D', relearning: '#B8003A' },
    note: 'Full BRAND at "mature". Set aside: DRILL_COLORS.again is already a true red meaning "you got this wrong" elsewhere in the same module — a mostly-red bar risks reading as "lots of problems" when it means the opposite.',
  },
  {
    label: 'Considered — cool blue',
    colors: { new: '#9AA0A6', learning: '#35506B', young: '#5B85B0', mature: '#9FC6E8', relearning: '#e0a72e' },
    note: 'The safest option for red-green CVD specifically (blue/yellow discrimination is far rarer to lack), but no grounding in the brand — set aside in favour of the amber family, which is literally the lantern\'s own colours.',
  },
]

function Swatches({ colors }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: SPACE_16 }}>
      {STATE_SEGMENTS.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: colors[s.key] ?? colors.new, flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: 'monospace' }}>{s.label} {colors[s.key]}</span>
        </div>
      ))}
    </div>
  )
}

// Mirrors DashboardPage's StatsPanel <aside> — the "home sidebar" instance.
function SidebarMock({ colors }) {
  return (
    <div style={{ width: 260, background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: SPACE_16 }}>
      <SectionHeader title="Vocabulary" />
      <div style={{ marginBottom: SPACE_12 }}>
        <DistributionBar segments={segmentsFor(SAMPLE_COUNTS)} colors={colors} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS_BASE, padding: '4px 0' }}>
        <span style={{ color: TEXT_MUTED }}>Cards</span><span style={{ color: TEXT }}>{SAMPLE_TOTAL}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS_BASE, padding: '4px 0' }}>
        <span style={{ color: TEXT_MUTED }}>Learned</span><span style={{ color: TEXT }}>{SAMPLE_COUNTS.young + SAMPLE_COUNTS.mature}</span>
      </div>
    </div>
  )
}

// Mirrors VocabSrsModule's DeckProgressBar — the "deck review page" instance
// (Reviews home, a single deck row's own bar + suspended badge).
function DeckReviewMock({ colors }) {
  return (
    <div style={{ width: 340, background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: SPACE_16 }}>
      <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 4 }}>Core 2000</div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 10 }}>{SAMPLE_TOTAL} cards · {SAMPLE_COUNTS.new} new</div>
      <DistributionBar segments={segmentsFor(SAMPLE_COUNTS)} colors={colors} />
      <div style={{ marginTop: 10 }}>
        <Badge tone="danger">⚠ {SAMPLE_SUSPENDED} suspended</Badge>
      </div>
    </div>
  )
}

function VariantSection({ variant }) {
  return (
    <div style={{ marginBottom: SPACE_32, paddingBottom: SPACE_32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader
        title={variant.label}
        action={variant.shipped && <Badge tone="success">Live now</Badge>}
      />
      <Swatches colors={variant.colors} />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16 }}>
        {variant.note}
      </div>
      <div style={{ display: 'flex', gap: SPACE_24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Home sidebar (Dashboard Stats panel)</div>
          <SidebarMock colors={variant.colors} />
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Deck review page (Reviews home, per-deck row)</div>
          <DeckReviewMock colors={variant.colors} />
        </div>
      </div>
    </div>
  )
}

function RetiredRow({ item }) {
  return (
    <div style={{ marginBottom: SPACE_16 }}>
      <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 6 }}>{item.label}</div>
      <Swatches colors={item.colors} />
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, maxWidth: 720, lineHeight: 1.5, opacity: 0.85 }}>{item.note}</div>
    </div>
  )
}

export default function SegmentColorLabPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, color: TEXT }}>
      <PageHeader crumbs={[{ label: 'Lantern', href: '#/' }, { label: 'Deck-state colour exploration' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: 8 }}>Deck-state distribution colour — the amber directions</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: 28 }}>
            Same sample deck through the real <code>DistributionBar</code> component in both places it actually
            appears — the Dashboard sidebar and a deck row on the Reviews home screen. Section 1 is what
            shipped; 2 and 3 are the single-hue alternatives it was tried against.
          </div>

          {AMBER_VARIANTS.map(v => <VariantSection key={v.id} variant={v} />)}

          <div style={{
            background: `${BRAND}14`, border: `1px solid ${BRAND}40`, borderRadius: 8,
            padding: SPACE_16, fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.6, maxWidth: 760, marginBottom: SPACE_32,
          }}>
            <strong style={{ color: TEXT }}>Shipped: the blend.</strong> It&apos;s the only one of the three that reaches
            both EMBER and GLOW, so it&apos;s the only one that actually tells the full &ldquo;getting brighter&rdquo; story —
            EMBER-only never gets to GLOW&apos;s brightness, GLOW-only never touches EMBER&apos;s warmth. It&apos;s also the only
            fully PICO-8-sourced option of the three (GLOW-only needed two interpolated, non-palette shades).
            Now formalized in theme.js as ACCENT_SECONDARY — GLOW, EMBER, and PICO-8 4 (brown) together, one
            secondary accent family, not a scattered set of ad hoc colours.
          </div>

          <SectionHeader title="Earlier directions, for the record" />
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16, opacity: 0.8 }}>
            Swatches only, not full mockups — these aren&apos;t live candidates, just the trail that led to the amber call.
          </div>
          {RETIRED.map(item => <RetiredRow key={item.label} item={item} />)}
        </div>
      </main>
    </div>
  )
}
