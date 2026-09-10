import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Badge from '../components/Badge.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import { STATE_SEGMENTS } from '../modules/vocab-srs/cardStates.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32, BRAND, SEGMENT_COLORS,
} from '../data/theme.js'

// Dev-only exploration, not linked from the dashboard — reached at
// #/dev/segment-colors. Answers two open questions from the rebrand: should
// SEGMENT_COLORS (the card-mastery ramp on DistributionBar) lean into BRAND,
// and if not, what else pairs well with it? DistributionBar takes an
// optional `colors` prop (defaulting to SEGMENT_COLORS) purely so this page
// can drive the real component with candidate palettes — production call
// sites never pass it. Same "real components, fake data" convention as
// CoverRotationLabPage/TextbookPickerLabPage.
//
// The current ramp (`learning`/`young`/`mature`: #4c8a7d/#5eb6a2/#7fe0c8) is
// flagged in CLAUDE.md as "validated for colour-vision deficiency and
// contrast... don't 'reconcile' it onto the semantic tokens without redoing
// that check" — that check isn't re-run here (no CVD simulator in this
// environment), so every option below is a judgment call grounded in colour
// theory and the DRILL_COLORS.again collision risk, not a re-validated one.
// Whichever option gets picked should get an honest CVD pass before it ships.

const SAMPLE_COUNTS = { new: 8, learning: 5, young: 12, mature: 34, relearning: 3 }
const SAMPLE_SUSPENDED = 2
const SAMPLE_TOTAL = Object.values(SAMPLE_COUNTS).reduce((a, b) => a + b, 0) + SAMPLE_SUSPENDED

function segmentsFor(counts) {
  return STATE_SEGMENTS.map(s => ({ ...s, count: counts[s.key] ?? 0 }))
}

// BRAND is #FF004D — hsl(342°, 100%, 50%), a saturated magenta-red. Its true
// complement sits at hsl(162°, …) — a teal/spring-green. The retired core
// teal (#3ABDA4, ~hsl(166°, 54%, 48%)) lands within a few degrees of that by
// coincidence, not design; option C leans on that.
const PALETTES = [
  {
    id: 'current',
    label: 'A — Current (unchanged)',
    colors: SEGMENT_COLORS,
    note: 'The control. Teal-green ordinal ramp (learning → young → mature getting lighter), inert grey for "new", amber for "relearning". No BRAND anywhere in it — this ramp predates the rebrand and was never module-accent-driven.',
    cvd: 'Already documented as CVD-validated in CLAUDE.md. Baseline for comparison, not re-checked here.',
  },
  {
    id: 'brand-forward',
    label: 'B — Brand-forward (monochrome red ramp)',
    colors: { new: '#6b6b6b', learning: '#FFD9E4', young: '#FF8FAE', mature: '#FF004D', relearning: '#B8003A' },
    note: 'Answers "should we use accent red a lot?" directly: a single-hue lightness ramp on BRAND\'s own hue, light pink → full BRAND at "mature" (reading as "this card has fully arrived at the brand colour"), dark red for "relearning". The real risk: DRILL_COLORS.again (rgb(192,57,43), a true red) already means "you got this wrong" elsewhere in the same module. A mostly-red distribution bar risks reading as "lots of problems" when it actually means "lots of well-learned cards" — the opposite of the intended signal. Mature and relearning are also both saturated reds here, easy to confuse at a glance.',
    cvd: 'A single-hue, lightness-only ramp doesn\'t rely on hue discrimination, so it\'s more robust to red-green CVD than it looks — but protanopia dampens perceived red brightness specifically, which could compress "mature" and "relearning" toward each other for exactly the users this is supposed to be safe for.',
  },
  {
    id: 'teal-refined',
    label: 'C — Teal complement (refined)',
    colors: { new: '#9AA0A6', learning: '#3F6B60', young: '#5EB6A2', mature: '#8FEBD4', relearning: '#E0A72E' },
    note: 'Confirms rather than replaces: the current ramp already sits close to BRAND\'s true complement, so this is a light refinement (cooler "new" grey, one more step of range on "mature") rather than a new direction. No BRAND anywhere in the ramp itself, same as A.',
    cvd: 'Same family as the validated current ramp — lowest-risk option of the four alternatives, though "refined" still means unverified until it gets the same CVD pass.',
  },
  {
    id: 'warm-amber',
    label: 'D — Warm amber, with a BRAND accent on Relearning',
    colors: { new: '#9AA0A6', learning: '#8A6A3D', young: '#C9944F', mature: '#F0C878', relearning: '#FF5C8A' },
    note: 'A warm ramp analogous to BRAND\'s hue neighbourhood (amber/gold, not literally red) for the ordinal mastery steps, with BRAND_TEXT — an existing brand token, not a new colour — reserved for the one state that\'s actually urgent ("relearning": just got it wrong, cooling down). This is the one option that uses a brand colour deliberately and narrowly rather than either avoiding it entirely (C) or spreading it across the whole ramp (B).',
    cvd: 'Amber/gold hues are generally safer for the common red-green CVD types than red-green pairings. BRAND_TEXT on "relearning" alone (not adjacent in the ramp to a similarly-saturated red) avoids B\'s mature/relearning collision.',
  },
  {
    id: 'cool-blue',
    label: 'E — Cool blue',
    colors: { new: '#9AA0A6', learning: '#35506B', young: '#5B85B0', mature: '#9FC6E8', relearning: '#E0A72E' },
    note: 'A second cool option, blue rather than teal — worth having if teal reads as too tied to the retired core-teal identity. Keeps amber on "relearning", unchanged from A/C.',
    cvd: 'Blue/yellow discrimination (tritanopia) is far rarer than red/green CVD, so a blue ramp is close to the safest hue family available for this specific accessibility concern.',
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

function PaletteSection({ palette }) {
  return (
    <div style={{ marginBottom: SPACE_32, paddingBottom: SPACE_32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader title={palette.label} />
      <Swatches colors={palette.colors} />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_12 }}>
        {palette.note}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: SPACE_16, opacity: 0.8 }}>
        CVD note: {palette.cvd}
      </div>
      <div style={{ display: 'flex', gap: SPACE_24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Home sidebar (Dashboard Stats panel)</div>
          <SidebarMock colors={palette.colors} />
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Deck review page (Reviews home, per-deck row)</div>
          <DeckReviewMock colors={palette.colors} />
        </div>
      </div>
    </div>
  )
}

export default function SegmentColorLabPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, color: TEXT }}>
      <PageHeader crumbs={[{ label: 'Lantern', href: '#/' }, { label: 'Deck-state colour exploration' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: 8 }}>Deck-state distribution colour — five options</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 760, lineHeight: 1.5, marginBottom: 28 }}>
            SEGMENT_COLORS (New / Learning / Young / Mature / Relearning) predates the rebrand and has
            no BRAND in it today. Same sample deck rendered through the real <code>DistributionBar</code> component
            in both places it actually appears — the Dashboard sidebar and a deck row on the Reviews home
            screen — for each candidate palette below.
          </div>

          {PALETTES.map(p => <PaletteSection key={p.id} palette={p} />)}

          <div style={{
            background: `${BRAND}14`, border: `1px solid ${BRAND}40`, borderRadius: 8,
            padding: SPACE_16, fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.6, maxWidth: 760,
          }}>
            <strong style={{ color: TEXT }}>Leaning towards D.</strong> B answers &ldquo;use red a lot&rdquo; honestly, but the
            DRILL_COLORS.again collision (mature and &ldquo;you got this wrong&rdquo; both reading as saturated red) is a real
            usability cost, not just a taste call. C is the safe, validated-family option but doesn&apos;t touch BRAND at
            all. D puts BRAND_TEXT somewhere it earns its place — the one state that&apos;s genuinely time-sensitive —
            without turning the whole ramp red. Not a final call — pick whichever reads best to you; this page&apos;s
            candidates make that a real side-by-side, not a guess.
          </div>
        </div>
      </main>
    </div>
  )
}
