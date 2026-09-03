import { useState, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataList from '../components/DataList.jsx'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import TextInput from '../components/TextInput.jsx'
import NumberField from '../components/NumberField.jsx'
import ChipSelector from '../components/Chip.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Toast from '../components/Toast.jsx'
import FeedCard from '../components/FeedCard.jsx'
import ToggleButton from '../components/ToggleButton.jsx'
import DistributionBar from '../components/DistributionBar.jsx'
import DrillButtonRow, { DrillButton } from '../components/DrillButton.jsx'
import DrillHUD from '../components/DrillHUD.jsx'
import Select from '../components/Select.jsx'
import Checkbox from '../components/Checkbox.jsx'
import DeckComboBox from '../components/DeckComboBox.jsx'
import { WordPopup } from '../components/JapaneseReader.jsx'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, BORDER as BORDER_TOKEN, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  FS_SM, FS_NAV, FS_BADGE, FS_DISPLAY_HEADING, FS_STAT_VALUE,
  FS_LIST_TITLE, FS_ENTRY_WORD, FS_ENTRY_KANJI, FS_ENTRY_HEADING, FS_ENTRY_ALT, FS_ARTICLE_BODY,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
  SEGMENT_COLORS, DRILL_COLORS,
} from '../data/theme.js'

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const ACCENT = '#3ABDA4'
const ANIME_ACCENT = '#D46EA3'
const BORDER = 'rgba(255,255,255,0.08)'
const KANJI_FONT = "'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif"
const WARNING = '#fbbf24'

// Every component in the system, built or not. Placeholders stay listed on
// purpose — this nav doubles as the progress tracker for the rebuild.
const NAV = [
  {
    section: 'Foundations',
    items: [
      { key: 'type', label: 'Type', built: true },
      { key: 'spacing', label: 'Spacing', built: true },
      { key: 'color', label: 'Color', built: true },
    ],
  },
  {
    section: 'Atoms',
    items: [
      { key: 'button', label: 'Button', built: true },
      { key: 'badge', label: 'Badge', built: true },
      { key: 'card', label: 'Card', built: true },
      { key: 'text-input', label: 'Text Input', built: true },
      { key: 'number-field', label: 'Number Field', built: true },
    ],
  },
  {
    section: 'Selection',
    items: [
      { key: 'chip', label: 'Chip Selector', built: true },
      { key: 'data-list', label: 'Data List', built: true },
    ],
  },
  {
    section: 'Overlays',
    items: [
      { key: 'modal', label: 'Modal', built: true },
      { key: 'toast', label: 'Toast', built: true },
    ],
  },
  {
    section: 'Patterns',
    items: [
      { key: 'feed-card', label: 'Feed Card', built: true },
      { key: 'toggle-button', label: 'Toggle Button', built: true },
      { key: 'distribution-bar', label: 'Distribution Bar', built: true },
      { key: 'deck-picker', label: 'Deck Picker', built: true },
      { key: 'definition-popover', label: 'Definition Popover', built: true },
    ],
  },
  {
    section: 'Drill',
    items: [
      { key: 'drill-button', label: 'Drill Button', built: true },
      { key: 'hud', label: 'Drill HUD', built: true },
    ],
  },
]

const DESCRIPTIONS = {
  type: '15px (FS_BASE) is the default for all body/UI text. One size — FS_CONTENT_HEADING — is proven reused across 3 unrelated screens already, so it gets its own tier as the general heading choice. Everything else belongs to one named screen each; three are marked Watch: single-use today, candidates for promotion once a component that would reuse them gets built.',
  spacing: '12px (SPACE_12) is the default gap/padding — reach for it first. Only drop tighter or step up when there’s a concrete reason, not by feel.',
  color: 'One core accent, five semantic tones, and a per-module accent each screen carries as its own identity. Two separate colour sets sit outside the semantic scale on purpose — see their notes.',
  button: 'Trigger an action. Six variants covering every real button family in the app, reconciled from 15+ call sites that each hand-rolled their own. An `icon` prop supplements or replaces the label — an icon-only button is this with no children, not a separate component.',
  badge: 'A small classification — JLPT level, part of speech, difficulty, SRS status. One atom with tone presets, replacing 8+ inline pill implementations.',
  card: 'A raised surface for grouping content. The same shell was written inline 8+ times.',
  'text-input': 'Single-line text entry. Reconciled from four real inputs; `bare` exists because an input inside an already-bordered container must not draw a second border.',
  'number-field': 'A small bounded number — a count, a threshold, a day offset.',
  chip: 'Pick one, several, or a threshold from a small visible set. Three selection models, not three styles — threshold is cumulative because "N3 and above" genuinely means N3/N2/N1, and rendering only N3 as active would misrepresent the filter.',
  'data-list': 'Every list in the app. Columns are configured per call site; selection, row-click, search, and footer are independent opt-in slots. A read-only list is just this with none of them — which is why there is no separate InfoRow component.',
  modal: 'The scrim + panel shell for every overlay: centred dialog on desktop, bottom sheet on mobile. ConfirmDialog is now a thin composition of this + Button rather than its own implementation.',
  toast: 'A transient confirmation with an optional inline action. Four placement variants; the dedicated Toast lab compares them side by side.',
  'feed-card': 'One item in a browsable feed. Reconciles Immersion’s ArticleCard and Story’s RecentCard, which had drifted on padding, hover mechanism, transition timing, and title font.',
  'toggle-button': 'A standalone on/off control whose label changes with its state — Follow/Unfollow, deck On/Off. Not a Button variant (its hover can mean the opposite action, which no resting-state variant expresses) and not a Chip (a chip picks one of a set and keeps a fixed label). Composes Chip so both share one visual language.',
  'distribution-bar': 'How a collection divides across states. Distinct from the progress bar, which shows one value’s completion.',
  'deck-picker': 'Pick an existing deck, or create one and pick it, in a single control — type to filter, and a "+ Create «typed»" row appears inline as soon as the query doesn’t match. Popover on desktop, bottom sheet on mobile. Chosen over DeckPickerSheet and SegmentedDeckAdd, which are retired.',
  'definition-popover': 'A word’s reading, part of speech, and gloss, anchored to the word you clicked — with adding it to a deck as a second view of the same surface rather than a second floating layer. Built on Popover + OptionPicker.',
  'drill-button': 'A judgment button in a drill. Consolidates SpeedModeControls’ Correct/Incorrect pair and VocabSrsDrill’s four-way RatingButton — the same control, differing only in padding, fill opacity, and whether a second line rendered.',
  hud: 'Live session stats during a drill — streak, correct, remaining, undo. Already shared across two modules; shown here as-is rather than rebuilt.',
}

/* ── Foundations data ──────────────────────────────────────────────────── */

const CORE_TYPE_TOKENS = [
  { names: ['FS_BADGE'], px: FS_BADGE, usage: 'inline pill labels — badges, tags', sample: 'N4' },
  { names: ['FS_SM'], px: FS_SM, usage: 'compact secondary text', sample: '2,007 cards · bundled' },
  { names: ['FS_BASE', 'FS_CAPTION', 'FS_HEADING', 'FS_ENTRY'], px: FS_BASE, isDefault: true, usage: 'use this — body text, captions, headings, dictionary entries all share it. Start here for any new text.', sample: 'You have 12 cards due today.' },
  { names: ['FS_NAV'], px: FS_NAV, usage: 'breadcrumb navigation, the one step up from body text', sample: 'Japanese Study / Vocabulary Training' },
]

const HEADING_TYPE_TOKENS = [
  { names: ['FS_CONTENT_HEADING'], px: FS_CONTENT_HEADING, usage: 'article title in reader, module stat summary, grammar node heading — 3 contexts already', sample: "Today's Review" },
]

const CONTENT_TYPE_TOKENS = [
  { names: ['FS_LIST_TITLE'], px: FS_LIST_TITLE, watch: 'promote if FeedCard reuses this for its title', usage: 'article card title in list view', sample: 'Core 2000' },
  { names: ['FS_ENTRY_ALT'], px: FS_ENTRY_ALT, usage: 'dictionary entry page alternate word forms', sample: '為る' },
  { names: ['FS_ARTICLE_BODY'], px: FS_ARTICLE_BODY, usage: 'article body text (reading-optimised, do not normalise)', sample: '今日は天気がいいです。' },
  { names: ['FS_ENTRY_WORD'], px: FS_ENTRY_WORD, usage: 'word form in dictionary results & word popup', sample: '世界' },
  { names: ['FS_STAT_VALUE'], watch: 'promote if HUD/other stat displays reuse this', px: FS_STAT_VALUE, usage: 'done-screen reviewed / again / time numbers', sample: '42' },
  { names: ['FS_DISPLAY_HEADING'], watch: 'promote if another completion-style screen reuses this', px: FS_DISPLAY_HEADING, usage: 'done-screen "Session complete"', sample: 'Session complete' },
  { names: ['FS_ENTRY_KANJI'], px: FS_ENTRY_KANJI, usage: 'dictionary large kanji display', sample: '語' },
  { names: ['FS_ENTRY_HEADING'], px: FS_ENTRY_HEADING, usage: 'dictionary entry page primary word/kanji display', sample: '語' },
]

const SPACE_TOKENS = [
  { name: 'SPACE_4', px: SPACE_4, usage: 'tightest — icon-to-label gaps, a stacked label/subtext pair' },
  { name: 'SPACE_8', px: SPACE_8, usage: 'compact gaps — chip rows, tight groupings' },
  { name: 'SPACE_12', px: SPACE_12, isDefault: true, usage: 'use this — the standard gap/padding. Start here for any new spacing.' },
  { name: 'SPACE_16', px: SPACE_16, usage: 'standard card/section padding' },
  { name: 'SPACE_24', px: SPACE_24, usage: 'page-level padding, section separation' },
  { name: 'SPACE_32', px: SPACE_32, usage: 'large section breaks' },
]

const CORE_COLORS = [
  { name: 'BG', hex: BG, usage: 'page background' },
  { name: 'SURFACE', hex: SURFACE, usage: 'card / panel background' },
  { name: 'SURFACE_HOVER', hex: '#313131', usage: 'row and card hover' },
  { name: 'BORDER', hex: BORDER_TOKEN, usage: 'header separator' },
  { name: 'TEXT', hex: TEXT, usage: 'primary text' },
  { name: 'TEXT_MUTED', hex: TEXT_MUTED, usage: 'secondary / label text' },
]

const SEMANTIC_COLORS = [
  { name: 'accent', hex: ACCENT, usage: 'primary actions, links, selected states' },
  { name: 'success', hex: '#4ade80', usage: 'correct answers, success messages' },
  { name: 'warning', hex: WARNING, usage: 'troubled cards, leeches, waiting state' },
  { name: 'danger', hex: '#f87171', usage: 'wrong answers, destructive actions' },
]

const MODULE_ACCENTS = [
  { name: 'vocab-srs', hex: '#3ABDA4', usage: 'also the app-wide core accent' },
  { name: 'anime-vocab', hex: '#D46EA3', usage: 'module-local' },
  { name: 'immersion', hex: '#E05A4E', usage: 'module-local' },
  { name: 'grammar-map', hex: '#8B7CF8', usage: 'module-local' },
  { name: 'story', hex: '#CC8A3D', usage: 'module-local' },
  { name: 'dictionary', hex: '#D4A84B', usage: 'module-local' },
  { name: 'katsuyou', hex: '#E8962E', usage: 'module-local' },
  { name: 'school-vocab', hex: '#3A7FEF', usage: 'module-local' },
]

/* ── Shared page chrome ────────────────────────────────────────────────── */

function ControlLabel({ children }) {
  return (
    <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: SPACE_4 }}>
      {children}
    </div>
  )
}

function GroupLabel({ children }) {
  return (
    <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '18px 0 4px' }}>
      {children}
    </div>
  )
}

function Pill({ label, color, textColor }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: FONT, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: textColor, background: color, borderRadius: 3, padding: '1px 6px', marginLeft: SPACE_8,
    }}>
      {label}
    </span>
  )
}

function ComponentPage({ title, description, built, preview, controls, notes }) {
  return (
    <div>
      <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: SPACE_8 }}>{title}</div>
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: SPACE_24, lineHeight: 1.5, maxWidth: 640 }}>{description}</div>

      {!built ? (
        <div style={{
          border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '48px 24px',
          textAlign: 'center', fontSize: FS_BASE, color: 'rgba(255,255,255,0.3)',
        }}>
          Not built yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: controls ? '1fr 260px' : '1fr', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', background: SURFACE, minHeight: 300 }}>
          <div style={{ padding: SPACE_32, display: 'flex', alignItems: 'flex-start' }}>{preview}</div>
          {controls && (
            <div style={{ padding: 20, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 18 }}>{controls}</div>
          )}
        </div>
      )}

      {notes && (
        <div style={{ marginTop: SPACE_16, fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.6, maxWidth: 640 }}>{notes}</div>
      )}
    </div>
  )
}

function FoundationPage({ title, description, children }) {
  return (
    <div>
      <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: SPACE_8 }}>{title}</div>
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: SPACE_24, lineHeight: 1.5, maxWidth: 640 }}>{description}</div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, padding: '4px 20px' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Foundations ───────────────────────────────────────────────────────── */

function TypeRow({ t, isLast }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: SPACE_24, padding: '16px 14px', margin: '0 -14px',
      borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
      background: t.isDefault ? 'rgba(58,189,164,0.07)' : 'transparent',
      borderLeft: t.isDefault ? `2px solid ${ACCENT}` : '2px solid transparent',
    }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: FS_CAPTION, color: TEXT, fontFamily: 'monospace', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {t.names.join(' / ')}
          {t.isDefault && <Pill label="Default" color={ACCENT} textColor="#0F2622" />}
          {t.watch && <Pill label="Watch" color={WARNING} textColor="#2E2405" />}
        </div>
        <div style={{ fontSize: FS_CAPTION, color: ACCENT, marginTop: 2 }}>{t.px}px</div>
        <div style={{ fontSize: FS_SM, color: TEXT_MUTED, marginTop: SPACE_4, lineHeight: 1.4 }}>{t.watch ?? t.usage}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: t.px, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t.sample}
      </div>
    </div>
  )
}

function TypePage() {
  return (
    <FoundationPage title="Type" description={DESCRIPTIONS.type}>
      <GroupLabel>Core — pick from these for new UI</GroupLabel>
      {CORE_TYPE_TOKENS.map(t => <TypeRow key={t.names[0]} t={t} isLast={false} />)}
      <GroupLabel>Headings — proven reused, the general heading choice</GroupLabel>
      {HEADING_TYPE_TOKENS.map(t => <TypeRow key={t.names[0]} t={t} isLast={false} />)}
      <GroupLabel>Content-specific — one named context each, not general-purpose</GroupLabel>
      {CONTENT_TYPE_TOKENS.map((t, i) => <TypeRow key={t.names[0]} t={t} isLast={i === CONTENT_TYPE_TOKENS.length - 1} />)}
    </FoundationPage>
  )
}

function SpacingPage() {
  const maxPx = SPACE_TOKENS[SPACE_TOKENS.length - 1].px
  return (
    <FoundationPage title="Spacing" description={DESCRIPTIONS.spacing}>
      {SPACE_TOKENS.map((s, i) => (
        <div key={s.name} style={{
          display: 'flex', alignItems: 'center', gap: SPACE_24, padding: '14px 14px', margin: '0 -14px',
          borderBottom: i < SPACE_TOKENS.length - 1 ? `1px solid ${BORDER}` : 'none',
          background: s.isDefault ? 'rgba(58,189,164,0.07)' : 'transparent',
          borderLeft: s.isDefault ? `2px solid ${ACCENT}` : '2px solid transparent',
        }}>
          <div style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: FS_CAPTION, color: TEXT, fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
              {s.name}
              {s.isDefault && <Pill label="Default" color={ACCENT} textColor="#0F2622" />}
            </div>
            <div style={{ fontSize: FS_CAPTION, color: ACCENT, marginTop: 2 }}>{s.px}px</div>
          </div>
          <div style={{ width: maxPx + 20, flexShrink: 0 }}>
            <div style={{ width: s.px, height: 14, background: ACCENT, borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.4 }}>{s.usage}</div>
        </div>
      ))}
    </FoundationPage>
  )
}

function ColorRow({ c, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_16, padding: '12px 0', borderBottom: isLast ? 'none' : `1px solid ${BORDER}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, background: c.hex, border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />
      <div style={{ width: 150, flexShrink: 0 }}>
        <div style={{ fontSize: FS_CAPTION, color: TEXT, fontFamily: 'monospace' }}>{c.name}</div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: 'monospace', marginTop: 2 }}>{c.hex}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.4 }}>{c.usage}</div>
    </div>
  )
}

function ColorPage() {
  const segmentList = Object.entries(SEGMENT_COLORS).map(([k, hex]) => ({ name: k, hex, usage: k === 'new' ? 'inert grey, deliberately outside the ramp' : 'ordinal ramp step' }))
  const drillList = Object.entries(DRILL_COLORS).map(([k, hex]) => ({ name: k, hex, usage: 'solid fill behind white text' }))

  return (
    <FoundationPage title="Color" description={DESCRIPTIONS.color}>
      <GroupLabel>Core surfaces &amp; text</GroupLabel>
      {CORE_COLORS.map((c, i) => <ColorRow key={c.name} c={c} isLast={i === CORE_COLORS.length - 1} />)}

      <GroupLabel>Semantic</GroupLabel>
      {SEMANTIC_COLORS.map((c, i) => <ColorRow key={c.name} c={c} isLast={i === SEMANTIC_COLORS.length - 1} />)}

      <GroupLabel>Module accents — each screen&apos;s own identity</GroupLabel>
      {MODULE_ACCENTS.map((c, i) => <ColorRow key={c.name} c={c} isLast={i === MODULE_ACCENTS.length - 1} />)}

      <GroupLabel>Card-state ramp — validated for colour-vision deficiency, do not normalise</GroupLabel>
      {segmentList.map((c, i) => <ColorRow key={c.name} c={c} isLast={i === segmentList.length - 1} />)}

      <GroupLabel>Drill judgment — Flat-UI lineage, separate from semantic on purpose</GroupLabel>
      {drillList.map((c, i) => <ColorRow key={c.name} c={c} isLast={i === drillList.length - 1} />)}
    </FoundationPage>
  )
}

/* ── Atoms ─────────────────────────────────────────────────────────────── */

const BUTTON_VARIANTS = ['primary', 'accent-outline', 'neutral', 'danger-outline', 'ghost', 'ghost-muted']
const BUTTON_VARIANT_OPTIONS = BUTTON_VARIANTS.map(v => ({ value: v, label: v }))
const BUTTON_SIZE_OPTIONS = ['sm', 'md', 'lg'].map(v => ({ value: v, label: v }))

function ButtonDemo() {
  const [variant, setVariant] = useState('primary')
  const [size, setSize] = useState('md')
  const [disabled, setDisabled] = useState(false)

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24, alignItems: 'flex-start' }}>
      <Button variant={variant} size={size} disabled={disabled}>Start Review</Button>
      <div>
        <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', marginBottom: SPACE_8 }}>All variants</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8 }}>
          {BUTTON_VARIANTS.map(v => <Button key={v} variant={v} size={size}>{v}</Button>)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', marginBottom: SPACE_8 }}>With an icon, and icon-only</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, alignItems: 'center' }}>
          <Button variant={variant} size={size} icon="♪">Play audio</Button>
          <Button variant="ghost-muted" size={size} icon="×" label="Dismiss" />
          <Button variant="ghost-muted" size={size} icon="♪" label="Mute" />
        </div>
      </div>
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Variant</ControlLabel><Select value={variant} onChange={setVariant} options={BUTTON_VARIANT_OPTIONS} /></div>
      <div><ControlLabel>Size</ControlLabel><Select value={size} onChange={setSize} options={BUTTON_SIZE_OPTIONS} /></div>
      <Checkbox checked={disabled} onChange={() => setDisabled(v => !v)} label="Disabled" />
    </>
  )

  return <ComponentPage title="Button" description={DESCRIPTIONS.button} built preview={preview} controls={controls} />
}

const BADGE_TONES = ['accent', 'success', 'warning', 'danger', 'neutral']
const BADGE_TONE_OPTIONS = BADGE_TONES.map(t => ({ value: t, label: t }))
const BADGE_VARIANT_OPTIONS = [{ value: 'fill', label: 'fill' }, { value: 'text', label: 'text' }]

function BadgeDemo() {
  const [tone, setTone] = useState('accent')
  const [variant, setVariant] = useState('fill')

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24, alignItems: 'flex-start' }}>
      <Badge tone={tone} variant={variant}>N4</Badge>
      <div>
        <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', marginBottom: SPACE_8 }}>All tones</div>
        <div style={{ display: 'flex', gap: SPACE_8, flexWrap: 'wrap' }}>
          {BADGE_TONES.map(t => <Badge key={t} tone={t} variant={variant}>{t}</Badge>)}
        </div>
      </div>
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Tone</ControlLabel><Select value={tone} onChange={setTone} options={BADGE_TONE_OPTIONS} /></div>
      <div><ControlLabel>Variant</ControlLabel><Select value={variant} onChange={setVariant} options={BADGE_VARIANT_OPTIONS} /></div>
    </>
  )

  return <ComponentPage title="Badge" description={DESCRIPTIONS.badge} built preview={preview} controls={controls} />
}

function CardDemo() {
  const [padding, setPadding] = useState(SPACE_16)
  const preview = (
    <Card padding={padding} style={{ width: 320 }}>
      <div style={{ fontSize: FS_BASE, color: TEXT, marginBottom: SPACE_4 }}>Core 2000</div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>2,007 cards · bundled deck</div>
    </Card>
  )
  const controls = <div><ControlLabel>Padding</ControlLabel><NumberField value={padding} onChange={setPadding} min={0} max={48} /></div>
  return <ComponentPage title="Card" description={DESCRIPTIONS.card} built preview={preview} controls={controls} />
}

const INPUT_VARIANT_OPTIONS = [{ value: 'default', label: 'default' }, { value: 'bare', label: 'bare' }]
const INPUT_SIZE_OPTIONS = ['sm', 'md', 'lg'].map(v => ({ value: v, label: v }))

function TextInputDemo() {
  const [value, setValue] = useState('')
  const [variant, setVariant] = useState('default')
  const [size, setSize] = useState('md')
  const [disabled, setDisabled] = useState(false)

  const preview = (
    <div style={{ width: 340 }}>
      <TextInput value={value} onChange={setValue} placeholder="Search Jiten.moe" variant={variant} size={size} disabled={disabled} />
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Variant</ControlLabel><Select value={variant} onChange={setVariant} options={INPUT_VARIANT_OPTIONS} /></div>
      <div><ControlLabel>Size</ControlLabel><Select value={size} onChange={setSize} options={INPUT_SIZE_OPTIONS} /></div>
      <Checkbox checked={disabled} onChange={() => setDisabled(v => !v)} label="Disabled" />
    </>
  )

  return <ComponentPage title="Text Input" description={DESCRIPTIONS['text-input']} built preview={preview} controls={controls} />
}

function NumberFieldDemo() {
  const [value, setValue] = useState(10)
  const [disabled, setDisabled] = useState(false)
  return (
    <ComponentPage
      title="Number Field"
      description={DESCRIPTIONS['number-field']}
      built
      preview={<NumberField value={value} onChange={setValue} min={0} max={999} disabled={disabled} />}
      controls={<Checkbox checked={disabled} onChange={() => setDisabled(v => !v)} label="Disabled" />}
    />
  )
}

/* ── Selection ─────────────────────────────────────────────────────────── */

const CHIP_MODE_OPTIONS = [
  { value: 'multi', label: 'multi — any subset' },
  { value: 'single', label: 'single — exactly one' },
  { value: 'threshold', label: 'threshold — this and above' },
]
const CHIP_SIZE_OPTIONS = [{ value: 'sm', label: 'sm — filter chips' }, { value: 'md', label: 'md — tabs / toggles' }]
const CHIP_ACCENT_OPTIONS = [{ value: ACCENT, label: 'core teal' }, { value: ANIME_ACCENT, label: 'anime pink' }]

const MULTI_OPTIONS = [
  { value: 'anime', label: 'Anime' }, { value: 'drama', label: 'Drama' },
  { value: 'movie', label: 'Movie' }, { value: 'manga', label: 'Manga' },
]
const JLPT_OPTIONS = [
  { value: 'N5', label: 'N5' }, { value: 'N4', label: 'N4' }, { value: 'N3', label: 'N3' },
  { value: 'N2', label: 'N2' }, { value: 'N1', label: 'N1' },
]
const TAB_OPTIONS = [{ value: 'text', label: 'Paste text' }, { value: 'image', label: 'Image (OCR)' }]

const CHIP_DIRECTION_OPTIONS = [
  { value: 'forward', label: 'forward — fills toward the end' },
  { value: 'backward', label: 'backward — fills toward the start' },
]

function ChipDemo() {
  const [mode, setMode] = useState('multi')
  const [thresholdDirection, setThresholdDirection] = useState('forward')
  const [size, setSize] = useState('sm')
  const [accent, setAccent] = useState(ACCENT)
  const [multi, setMulti] = useState(() => new Set(['anime']))
  const [single, setSingle] = useState('text')
  const [threshold, setThreshold] = useState('N3')

  const config = {
    multi: { options: MULTI_OPTIONS, value: multi, onChange: setMulti, caption: 'Media-type filter — independent toggles.' },
    single: { options: TAB_OPTIONS, value: single, onChange: setSingle, caption: 'Import tabs — exactly one active.' },
    threshold: {
      options: JLPT_OPTIONS, value: threshold, onChange: setThreshold,
      caption: thresholdDirection === 'forward'
        ? 'Minimum JLPT level — picking N3 means N3 and above, so N2 and N1 light up too.'
        : 'Same row, filling the other way — for options ordered so that "and above" runs toward the start of the list.',
    },
  }[mode]

  // No `accent` prop anywhere below — the provider supplies it, which is
  // exactly how a module root will wrap its own screens.
  const preview = (
    <ModuleThemeProvider accent={accent}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12, width: '100%' }}>
        <ChipSelector options={config.options} value={config.value} onChange={config.onChange} mode={mode} thresholdDirection={thresholdDirection} size={size} />
        <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.5 }}>{config.caption}</div>
      </div>
    </ModuleThemeProvider>
  )

  const controls = (
    <>
      <div><ControlLabel>Mode</ControlLabel><Select value={mode} onChange={setMode} options={CHIP_MODE_OPTIONS} /></div>
      {mode === 'threshold' && (
        <div><ControlLabel>Fill direction</ControlLabel><Select value={thresholdDirection} onChange={setThresholdDirection} options={CHIP_DIRECTION_OPTIONS} /></div>
      )}
      <div><ControlLabel>Size</ControlLabel><Select value={size} onChange={setSize} options={CHIP_SIZE_OPTIONS} /></div>
      <div><ControlLabel>Module accent</ControlLabel><Select value={accent} onChange={setAccent} options={CHIP_ACCENT_OPTIONS} /></div>
    </>
  )

  const notes = <>The accent is set once by a <code style={{ color: TEXT }}>&lt;ModuleThemeProvider&gt;</code> wrapping the preview — the chips themselves take no accent prop. Switching it here is what happens when the same component renders inside a different module.</>

  return <ComponentPage title="Chip Selector" description={DESCRIPTIONS.chip} built preview={preview} controls={controls} notes={notes} />
}

const WORD_COLUMNS = [
  { key: 'kanji', width: 90, fontFamily: KANJI_FONT, render: r => r.kanji },
  { key: 'reading', width: 72, tone: 'muted', fontFamily: KANJI_FONT, render: r => r.reading },
  { key: 'gloss', flex: '1 1 0', tone: 'muted', render: r => r.gloss },
  { key: 'jlpt', width: 40, render: r => r.jlpt && <Badge tone="accent">{r.jlpt}</Badge> },
  { key: 'status', width: 90, render: r => r.status && <Badge tone={r.statusTone}>{r.status}</Badge> },
]

const WORD_SEED = [
  { id: 'w1', kanji: '世界', reading: 'せかい', gloss: 'world', jlpt: 'N4', status: 'Learning', statusTone: 'warning' },
  { id: 'w2', kanji: '先生', reading: 'せんせい', gloss: 'teacher', jlpt: 'N5', status: 'Mature', statusTone: 'success' },
  { id: 'w3', kanji: '刺激', reading: 'しげき', gloss: 'stimulus', jlpt: '~N3', status: 'Relearning', statusTone: 'danger' },
  { id: 'w4', kanji: '部屋', reading: 'へや', gloss: 'room', jlpt: null, status: null },
]

const ROW_CLICK_OPTIONS = [
  { value: 'none', label: 'Inert' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'expand', label: 'Expand' },
]

function DataListDemo() {
  const [selectable, setSelectable] = useState(true)
  const [rowClick, setRowClick] = useState('none')
  const [showSearch, setShowSearch] = useState(false)
  const [showFooter, setShowFooter] = useState(true)
  const [editable, setEditable] = useState(false)
  const [rows, setRows] = useState(WORD_SEED)
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [query, setQuery] = useState('')
  const [navLog, setNavLog] = useState(null)

  function toggleSet(setFn) {
    return id => setFn(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const displayed = query.trim()
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(query.trim().toLowerCase()))
    : rows

  const preview = (
    <div style={{ width: '100%' }}>
      <DataList
        columns={WORD_COLUMNS}
        rows={displayed}
        maxWidth={480}
        selection={selectable ? { selected, onToggle: toggleSet(setSelected), bulkHeader: true } : undefined}
        navigate={rowClick === 'navigate' ? { onClick: row => setNavLog(`Would open "${row.kanji}"`) } : undefined}
        expand={rowClick === 'expand' ? {
          expanded, onToggle: toggleSet(setExpanded),
          render: row => <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Kanji breakdown for {row.kanji} would render here.</div>,
        } : undefined}
        editableFields={editable ? ['kanji', 'reading', 'gloss'] : undefined}
        onFieldChange={(row, key, value) => setRows(prev => prev.map(r => (r.id === row.id ? { ...r, [key]: value } : r)))}
        search={showSearch ? { value: query, onChange: setQuery, placeholder: 'Filter rows...' } : undefined}
        footer={showFooter ? <Button variant="primary" size="lg" disabled={selectable && selected.size === 0}>{selectable ? `Start Drill (${selected.size})` : 'Continue'}</Button> : undefined}
      />
      {navLog && <div style={{ marginTop: SPACE_8, fontSize: FS_CAPTION, color: ACCENT }}>{navLog}</div>}
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Selection</ControlLabel><Checkbox checked={selectable} onChange={() => setSelectable(v => !v)} label="Bulk-select" /></div>
      <div><ControlLabel>Row click</ControlLabel><Select value={rowClick} onChange={setRowClick} options={ROW_CLICK_OPTIONS} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_8 }}>
        <ControlLabel>Slots</ControlLabel>
        <Checkbox checked={showSearch} onChange={() => setShowSearch(v => !v)} label="Search bar" />
        <Checkbox checked={showFooter} onChange={() => setShowFooter(v => !v)} label="Footer action" />
        <Checkbox checked={editable} onChange={() => setEditable(v => !v)} label="Editable rows" />
      </div>
    </>
  )

  const notes = <>Turn on <strong style={{ color: TEXT }}>Bulk-select</strong> and <strong style={{ color: TEXT }}>Navigate</strong> together for the Shopify-style row: check the box to select, click anywhere else to open.</>

  return <ComponentPage title="Data List" description={DESCRIPTIONS['data-list']} built preview={preview} controls={controls} notes={notes} />
}

/* ── Overlays ──────────────────────────────────────────────────────────── */

const MODAL_SIZE_OPTIONS = ['sm', 'md', 'lg'].map(v => ({ value: v, label: v }))

function ModalDemo() {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [size, setSize] = useState('md')
  const [isMobile, setIsMobile] = useState(false)

  const preview = (
    <div style={{ display: 'flex', gap: SPACE_12 }}>
      <Button variant="accent-outline" onClick={() => setOpen(true)}>Open modal</Button>
      <Button variant="danger-outline" onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Choose a deck"
        size={size}
        isMobile={isMobile}
        footer={<><Button variant="neutral" onClick={() => setOpen(false)}>Cancel</Button><Button variant="accent-outline" onClick={() => setOpen(false)}>Confirm</Button></>}
      >
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.6 }}>
          Any content mounts here. On mobile this same modal becomes a bottom sheet — toggle the control to see it.
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete deck?"
        message={'This will permanently delete "Imported Words" and all 18 cards in it. This cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Size</ControlLabel><Select value={size} onChange={setSize} options={MODAL_SIZE_OPTIONS} /></div>
      <Checkbox checked={isMobile} onChange={() => setIsMobile(v => !v)} label="Mobile (bottom sheet)" />
    </>
  )

  return <ComponentPage title="Modal" description={DESCRIPTIONS.modal} built preview={preview} controls={controls} />
}

const TOAST_VARIANT_OPTIONS = ['bottom-card', 'bottom-bar', 'top-card', 'top-bar'].map(v => ({ value: v, label: v }))

function ToastDemo() {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState('bottom-card')
  const [withAction, setWithAction] = useState(true)

  const preview = (
    <div>
      <Button variant="accent-outline" onClick={() => setOpen(true)}>Trigger toast</Button>
      <Toast
        open={open}
        variant={variant}
        message="Added 3 words to Imported Words."
        actionLabel={withAction ? 'Undo' : undefined}
        onAction={() => {}}
        onDismiss={() => setOpen(false)}
      />
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Variant</ControlLabel><Select value={variant} onChange={setVariant} options={TOAST_VARIANT_OPTIONS} /></div>
      <Checkbox checked={withAction} onChange={() => setWithAction(v => !v)} label="With Undo action" />
    </>
  )

  return <ComponentPage title="Toast" description={DESCRIPTIONS.toast} built preview={preview} controls={controls} />
}

/* ── Patterns ──────────────────────────────────────────────────────────── */

function FeedCardDemo() {
  const [read, setRead] = useState(false)
  const [withSubtitle, setWithSubtitle] = useState(true)

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12, width: 420 }}>
      <FeedCard
        badges={[{ label: 'NHK Easy', tone: 'accent' }, { label: 'N4', tone: 'neutral' }]}
        title="日本の桜が今年は早く咲きました"
        subtitle={withSubtitle ? "Japan's cherry blossoms bloomed early this year" : undefined}
        meta="Aug 28, 2026"
        read={read}
      />
      <FeedCard
        badges={[{ label: 'Dialogue', tone: 'neutral' }]}
        title="コンビニでの会話"
        meta="Aug 27, 2026"
      />
    </div>
  )

  const controls = (
    <>
      <Checkbox checked={read} onChange={() => setRead(v => !v)} label="Read state" />
      <Checkbox checked={withSubtitle} onChange={() => setWithSubtitle(v => !v)} label="Subtitle" />
    </>
  )

  return <ComponentPage title="Feed Card" description={DESCRIPTIONS['feed-card']} built preview={preview} controls={controls} />
}

const TOGGLE_TONE_OPTIONS = [
  { value: 'accent', label: 'accent — module colour' },
  { value: 'success', label: 'success — followed/saved' },
  { value: 'neutral', label: 'neutral — view-mode switch (furigana)' },
]

function ToggleButtonDemo() {
  const [followed, setFollowed] = useState(false)
  const [deckOn, setDeckOn] = useState(true)
  const [activeTone, setActiveTone] = useState('success')
  const [destructiveHover, setDestructiveHover] = useState(true)
  const [disabled, setDisabled] = useState(false)

  const preview = (
    <ModuleThemeProvider accent={ANIME_ACCENT}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', marginBottom: SPACE_8 }}>Follow / Unfollow — anime episode</div>
          <ToggleButton
            active={followed}
            labels={{ on: 'Unfollow', off: 'Follow' }}
            onClick={() => setFollowed(v => !v)}
            size="md"
            activeTone={activeTone}
            destructiveHover={destructiveHover}
            disabled={disabled}
          />
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', marginBottom: SPACE_8 }}>Deck On / Off — SRS home (accent tone, non-destructive)</div>
          <ToggleButton
            active={deckOn}
            labels={{ on: 'On', off: 'Off' }}
            onClick={() => setDeckOn(v => !v)}
            activeTone="accent"
          />
        </div>
      </div>
    </ModuleThemeProvider>
  )

  const controls = (
    <>
      <div><ControlLabel>Active tone</ControlLabel><Select value={activeTone} onChange={setActiveTone} options={TOGGLE_TONE_OPTIONS} /></div>
      <Checkbox checked={destructiveHover} onChange={() => setDestructiveHover(v => !v)} label="Destructive hover" subtext="Turn on, then hover while active — it reddens to preview undoing." />
      <Checkbox checked={disabled} onChange={() => setDisabled(v => !v)} label="Disabled" />
    </>
  )

  const notes = <>Both examples are the same component. The follow toggle takes its inactive accent from the surrounding module theme (pink here); the deck toggle uses the accent tone for its active state because turning a deck off isn&apos;t destructive.</>

  return <ComponentPage title="Toggle Button" description={DESCRIPTIONS['toggle-button']} built preview={preview} controls={controls} notes={notes} />
}

const DECK_SEGMENTS = [
  { key: 'new', label: 'Unlearned', count: 412, description: 'Never reviewed — waiting for its first study session' },
  { key: 'learning', label: 'Learning', count: 38, description: 'Answered correctly once, not yet graduated' },
  { key: 'young', label: 'Young', count: 156, description: 'Graduated, interval under 21 days — still fragile' },
  { key: 'mature', label: 'Mature', count: 890, description: 'Graduated with a 21+ day interval' },
  { key: 'relearning', label: 'Relearning', count: 11, description: 'Was graduated, just answered wrong' },
]

function DistributionBarDemo() {
  const [showLegend, setShowLegend] = useState(true)
  return (
    <ComponentPage
      title="Distribution Bar"
      description={DESCRIPTIONS['distribution-bar']}
      built
      preview={<div style={{ width: 420 }}><DistributionBar segments={DECK_SEGMENTS} showLegend={showLegend} /></div>}
      controls={<Checkbox checked={showLegend} onChange={() => setShowLegend(v => !v)} label="Legend" />}
    />
  )
}

const SEED_DECKS = {
  'immersion-words': { id: 'immersion-words', name: 'Immersion Words', source: 'imported', addedAt: 1 },
  'story-words': { id: 'story-words', name: 'Story Words', source: 'imported', addedAt: 2 },
  'vocab-drill-words': { id: 'vocab-drill-words', name: 'Vocab Drill Words', source: 'imported', addedAt: 3 },
}

function DeckPickerDemo() {
  const [isMobile, setIsMobile] = useState(false)
  const [decks, setDecks] = useState(SEED_DECKS)
  const [log, setLog] = useState(null)

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
      <DeckComboBox
        decks={decks}
        isMobile={isMobile}
        onAdd={id => setLog(`Added to "${decks[id].name}"`)}
        onCreateAndAdd={name => {
          const id = `deck-${Date.now()}`
          setDecks(prev => ({ ...prev, [id]: { id, name, source: 'imported', addedAt: Date.now() } }))
          setLog(`Created "${name}" and added to it`)
        }}
      />
      {log && <div style={{ fontSize: FS_CAPTION, color: ACCENT }}>{log}</div>}
      <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.5, maxWidth: 380 }}>
        Type a name that doesn&apos;t exist to see the create row — it really does add a deck to this demo&apos;s list.
      </div>
    </div>
  )

  const controls = <Checkbox checked={isMobile} onChange={() => setIsMobile(v => !v)} label="Mobile (bottom sheet)" />

  return <ComponentPage title="Deck Picker" description={DESCRIPTIONS['deck-picker']} built preview={preview} controls={controls} />
}

function DefinitionPopoverDemo() {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [log, setLog] = useState(null)
  const wordRef = useRef(null)

  const preview = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: FS_ARTICLE_BODY, fontFamily: KANJI_FONT, color: TEXT, lineHeight: 2 }}>
        今日は
        <span
          ref={wordRef}
          onClick={() => { setOpen(true); setLog(null) }}
          style={{ background: 'rgba(224,90,78,0.22)', cursor: 'pointer', padding: '0 2px', borderRadius: 3 }}
        >
          世界
        </span>
        で一番いい天気です。
      </div>
      {log && <div style={{ fontSize: FS_CAPTION, color: ACCENT }}>{log}</div>}
      <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.5, maxWidth: 420 }}>
        Click the highlighted word, then &ldquo;Add to SRS&rdquo; — the panel swaps to the deck list in
        place instead of opening a second popover on top of itself.
      </div>

      {open && (
        <WordPopup
          token={{ t: '世界', r: 'せかい' }}
          vocabEntry={{ pos: 'Noun', meaning: 'world; society; the universe' }}
          decks={SEED_DECKS}
          lastUsedDeckId="immersion-words"
          isMobile={isMobile}
          anchorRect={wordRef.current?.getBoundingClientRect()}
          onClose={() => setOpen(false)}
          onAdd={(token, entry, deckId) => setLog(`Added 世界 to "${SEED_DECKS[deckId]?.name ?? deckId}"`)}
          onCreateAndAdd={(token, entry, name) => setLog(`Created "${name}" and added 世界`)}
        />
      )}
    </div>
  )

  const controls = <Checkbox checked={isMobile} onChange={() => setIsMobile(v => !v)} label="Mobile (bottom sheet)" />

  return <ComponentPage title="Definition Popover" description={DESCRIPTIONS['definition-popover']} built preview={preview} controls={controls} />
}

/* ── Drill ─────────────────────────────────────────────────────────────── */

const DRILL_LAYOUT_OPTIONS = [
  { value: 'verdict', label: 'Verdict pair (speed mode)' },
  { value: 'rating', label: 'Four-way rating (SRS)' },
  { value: 'placeholder', label: 'Pre-flip placeholder' },
]

function DrillButtonDemo() {
  const [layout, setLayout] = useState('rating')

  const preview = (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      {layout === 'placeholder' ? (
        <DrillButtonRow placeholder="Space or tap to flip" />
      ) : layout === 'verdict' ? (
        <DrillButtonRow>
          <DrillButton label="Incorrect" hint="Z" color={DRILL_COLORS.again} />
          <DrillButton label="Correct" hint="X" color={DRILL_COLORS.good} />
        </DrillButtonRow>
      ) : (
        <DrillButtonRow>
          <DrillButton label="Again" hint="1" sublabel="&lt;10m" color={DRILL_COLORS.again} />
          <DrillButton label="Hard" hint="2" sublabel="2d" color={DRILL_COLORS.hard} />
          <DrillButton label="Good" hint="3" sublabel="5d" color={DRILL_COLORS.good} />
          <DrillButton label="Easy" hint="4" sublabel="12d" color={DRILL_COLORS.easy} />
        </DrillButtonRow>
      )}
    </div>
  )

  const controls = <div><ControlLabel>Layout</ControlLabel><Select value={layout} onChange={setLayout} options={DRILL_LAYOUT_OPTIONS} /></div>

  return <ComponentPage title="Drill Button" description={DESCRIPTIONS['drill-button']} built preview={preview} controls={controls} />
}

function HudDemo() {
  const [streak, setStreak] = useState(7)
  const [showVisualEffects, setShowVisualEffects] = useState(true)

  const preview = (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <DrillHUD
        streak={streak}
        bestStreak={22}
        correct={14}
        troubled={3}
        remaining={28}
        canUndo
        onUndo={() => {}}
        showStreak
        showVisualEffects={showVisualEffects}
      />
    </div>
  )

  const controls = (
    <>
      <div><ControlLabel>Streak</ControlLabel><NumberField value={streak} onChange={setStreak} min={0} max={40} /></div>
      <Checkbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Visual effects" />
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.4 }}>
        Streak text grows to 12, wiggles past 10, waves past 20.
      </div>
    </>
  )

  return <ComponentPage title="Drill HUD" description={DESCRIPTIONS.hud} built preview={preview} controls={controls} />
}

/* ── Shell ─────────────────────────────────────────────────────────────── */

const PAGES = {
  type: TypePage,
  spacing: SpacingPage,
  color: ColorPage,
  button: ButtonDemo,
  badge: BadgeDemo,
  card: CardDemo,
  'text-input': TextInputDemo,
  'number-field': NumberFieldDemo,
  chip: ChipDemo,
  'data-list': DataListDemo,
  modal: ModalDemo,
  toast: ToastDemo,
  'feed-card': FeedCardDemo,
  'toggle-button': ToggleButtonDemo,
  'distribution-bar': DistributionBarDemo,
  'deck-picker': DeckPickerDemo,
  'definition-popover': DefinitionPopoverDemo,
  'drill-button': DrillButtonDemo,
  hud: HudDemo,
}

function NavItem({ item, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={active ? 'style-guide-nav-item style-guide-nav-item--active' : 'style-guide-nav-item'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE_8,
        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING,
        color: active ? TEXT : TEXT_MUTED,
      }}
    >
      <span>{item.label}</span>
      {!item.built && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />}
    </div>
  )
}

export default function StyleGuideLabPage() {
  const [activeKey, setActiveKey] = useState('type')
  const activeItem = NAV.flatMap(s => s.items).find(i => i.key === activeKey)
  const Page = PAGES[activeKey]

  return (
    <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT, overflow: 'hidden' }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Style guide' }]} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <nav style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${BORDER}`, overflowY: 'auto', padding: '20px 12px' }}>
          {NAV.map(section => (
            <div key={section.section} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: SPACE_4 }}>
                {section.section}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {section.items.map(item => (
                  <NavItem key={item.key} item={item} active={item.key === activeKey} onClick={() => setActiveKey(item.key)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 60px' }}>
          <div style={{ maxWidth: 820 }}>
            {Page ? <Page /> : <ComponentPage title={activeItem.label} description={DESCRIPTIONS[activeItem.key]} built={false} />}
          </div>
        </main>
      </div>
    </div>
  )
}
