import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Card from '../components/Card.jsx'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import { MODULES } from '../data/modules.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_STAT_VALUE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

// Exploration only — three candidate shapes for the shared "tracked" stat
// component a module's own page would use to show its own single-count
// stat (the same numbers the dashboard's Stats sidebar group now shows:
// "Series tracked", "Stories generated", "Articles read"). Not wired to
// real data, not linked from the dashboard, not built into any module page
// yet — see the Home page redesign scope in CLAUDE.md. Same pattern as
// HomeCardsLabPage/HomeFlowLabPage: reached at #/dev/tracked-stat.

const BG = '#1E1E1E'

const ANIME = MODULES.find(m => m.id === 'anime-vocab')
const STORY = MODULES.find(m => m.id === 'story')
const IMMERSION = MODULES.find(m => m.id === 'immersion')

const FIXTURES = [
  { module: ANIME, label: 'Series tracked', unit: 'series', value: 12 },
  { module: STORY, label: 'Stories generated', unit: 'stories', value: 8 },
  { module: IMMERSION, label: 'Articles read', unit: 'articles', value: 24 },
]

// ── Option A — inline pill ───────────────────────────────────────────────
// Small rounded chip: accent-tinted count + unit label, one line. Sized to
// sit next to a module's PageHeader crumbs (rightSlot) without competing
// with the page title for attention — a glance, not a destination.
function PillStat({ unit, value }) {
  const accent = useAccent()
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: SPACE_8,
      padding: `${SPACE_4}px ${SPACE_12}px`, borderRadius: 999,
      background: `${accent}1f`, border: `1px solid ${accent}55`,
      fontFamily: FONT, letterSpacing: TRACKING,
    }}>
      <span style={{ fontSize: FS_BASE, color: accent, fontWeight: 'bold' }}>{value}</span>
      <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{unit}</span>
    </div>
  )
}

// ── Option B — stat tile ─────────────────────────────────────────────────
// A standalone Card: big number, label underneath, accent as a left rule —
// the same visual weight as a done-screen stat (FS_STAT_VALUE), meant to
// stand on its own inside a module's home screen, e.g. next to its deck
// list, not tucked into the header.
function TileStat({ label, value }) {
  const accent = useAccent()
  return (
    <Card padding={SPACE_16} style={{ borderLeft: `3px solid ${accent}`, minWidth: 140 }}>
      <div style={{ fontSize: FS_STAT_VALUE, color: TEXT, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: SPACE_4 }}>{label}</div>
    </Card>
  )
}

// ── Option C — sidebar-style line ────────────────────────────────────────
// Reuses the exact "Unit tracked — count" phrasing the dashboard's Stats
// group now renders, so a module's own page visually rhymes with the
// dashboard rather than introducing a third way to show the same fact.
function LineStat({ label, value }) {
  return (
    <div style={{ fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING }}>
      <span style={{ color: TEXT_MUTED }}>{label}</span>
      <span style={{ color: TEXT_MUTED }}> — </span>
      <span style={{ color: TEXT }}>{value}</span>
    </div>
  )
}

const OPTIONS = [
  {
    key: 'pill',
    title: 'A — Inline pill',
    note: 'Lives in a module\'s PageHeader rightSlot, next to the breadcrumb. Lowest footprint; reads as a glance, not a stat page.',
    render: f => <PillStat label={f.label} unit={f.unit} value={f.value} />,
  },
  {
    key: 'tile',
    title: 'B — Stat tile',
    note: 'A standalone Card on the module\'s own home screen, alongside its deck/list content. Most visual weight; room to grow (e.g. a trend line later).',
    render: f => <TileStat label={f.label} value={f.value} />,
  },
  {
    key: 'line',
    title: 'C — Sidebar-style line',
    note: 'Exact "Unit — count" phrasing from the dashboard\'s Stats group, dropped into a module page\'s own sidebar/details panel. Cheapest to keep in sync visually with the dashboard.',
    render: f => <LineStat label={f.label} value={f.value} />,
  },
]

export default function TrackedStatLabPage() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
    }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Tracked stat' }]} />

      <main style={{ flex: 1, overflowY: 'auto', padding: SPACE_24 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Per-module tracked stat — layout options</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, maxWidth: 680, lineHeight: 1.5, marginBottom: SPACE_32 }}>
            Sketches only — not a built component, not wired to real data, not linked from any
            module page. Each option renders the same three fixture numbers (the numbers the
            dashboard&apos;s Stats sidebar group already shows) so they can be judged side by side
            before one gets built for real.
          </div>

          {OPTIONS.map(opt => (
            <div key={opt.key} style={{ marginBottom: SPACE_32 }}>
              <SectionHeader title={opt.title} />
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, opacity: 0.8, maxWidth: 640, marginBottom: SPACE_16, lineHeight: 1.5 }}>
                {opt.note}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_24 }}>
                {FIXTURES.map(f => (
                  <ModuleThemeProvider key={f.module.id} accent={f.module.accent}>
                    {opt.render(f)}
                  </ModuleThemeProvider>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
