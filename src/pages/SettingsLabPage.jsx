import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Card from '../components/Card.jsx'
import FilterCard from '../components/FilterCard.jsx'
import ChipSelector, { Chip } from '../components/Chip.jsx'
import ToggleButton from '../components/ToggleButton.jsx'
import Select from '../components/Select.jsx'
import Checkbox from '../components/Checkbox.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Badge from '../components/Badge.jsx'
import Notice from '../components/Notice.jsx'
import Button from '../components/Button.jsx'
import { buildFurigana } from '../utils/furigana.js'
import { SENTENCE_SOURCE_OPTIONS } from '../data/sentenceSource.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_SM, FS_BADGE,
  FS_CONTENT_HEADING, SUBHEADING_STYLE,
  SPACE_4, SPACE_8, SPACE_12, SPACE_16, SPACE_24, SPACE_32,
} from '../data/theme.js'

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const PANEL_W = 392  // SettingsSidebar's real content width (420 panel - 28 chevron)

// The pretend drilling context every variant is judged against. `recommended`
// is the proposal on the table: per-list defaults, so a beginner book opens
// with furigana on and an N2 vocabulary book opens with it off. `audio` is the
// other real variable — bundled lists have generated Voicevox files, a deck
// the user imported themselves has nothing but the browser voice.
const CONTEXTS = [
  {
    id: 'genki-1',
    label: 'Genki 1',
    meta: 'Beginner · N5 · Lesson 3',
    audio: 'voicevox',
    recommended: { furigana: true, translation: true, kanjiMeanings: true, sentence: true, voice: 'voicevox-11' },
    why: 'A beginner still reads kana faster than kanji. Furigana on the front is the difference between a card that teaches and a card that stumps.',
  },
  {
    id: 'nsm-n2',
    label: 'So-Matome N2',
    meta: 'Advanced · N2 · Week 2, Day 1',
    audio: 'voicevox',
    recommended: { furigana: false, translation: true, kanjiMeanings: false, sentence: true, voice: 'voicevox-11' },
    why: 'At N2 the reading is the thing being tested. Furigana on the front turns every card into a free pass.',
  },
  {
    id: 'word-import',
    label: 'Imported Words',
    meta: 'Your own words · from photo / text import',
    audio: 'none',
    recommended: { furigana: true, translation: true, kanjiMeanings: true, sentence: false, voice: 'browser' },
    why: 'Words photographed out in the wild. No generated audio exists for them and no curated sentence either — so the panel should not offer settings that resolve to nothing.',
  },
]

const WORD = {
  form: '経験',
  reading: 'けいけん',
  english: 'experience',
  sentence: '日本で働いた経験があります。',
  kanjiMeanings: { 経: 'pass through', 験: 'verification' },
}

const VOICE_OPTIONS = [
  { value: 'voicevox-11', label: 'Male (Kurono Takehiro)' },
  { value: 'voicevox-2', label: 'Female (Shikoku Metan)' },
  { value: 'browser', label: 'Browser voice' },
]

const DEFAULTS = {
  furigana: true,
  translation: true,
  kanjiMeanings: false,
  sentence: true,
  sentenceSource: 'custom',
  audio: true,
  voice: 'voicevox-11',
  autoplayFront: true,
  autoplayBack: true,
  sfx: true,
  pixelFont: true,
  visualEffects: true,
  streak: true,
}

const PRESETS = {
  recommended: { label: 'Recommended', hint: 'Whatever this list is set up for' },
  reading: {
    label: 'Reading',
    hint: 'Kanji unaided, meaning revealed',
    values: { furigana: false, translation: true, kanjiMeanings: true, sentence: true, audio: false },
  },
  listening: {
    label: 'Listening',
    hint: 'Audio leads, text supports',
    values: { furigana: true, translation: true, kanjiMeanings: false, sentence: true, audio: true, autoplayFront: true },
  },
  minimal: {
    label: 'Minimal',
    hint: 'Word and meaning, nothing else',
    values: { furigana: false, translation: true, kanjiMeanings: false, sentence: false, audio: false },
  },
}

function SpeakerIcon({ muted, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" opacity={muted ? 0.4 : 0.9} />
      {muted
        ? <path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        : <path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  )
}

// ── Preview card ────────────────────────────────────────────────────────
// A stand-in for VocabCard — same cream face and stacking order, but with
// the kanji meanings hardcoded so the lab needs no Supabase round-trip.
const CARD_BG = '#E8E4DE'

function Ruby({ text, reading, jaFont, show }) {
  if (!show) return <span style={{ fontFamily: jaFont }}>{text}</span>
  return (
    <span style={{ fontFamily: jaFont }}>
      {buildFurigana(text, reading).map((part, i) => part.type === 'kanji' ? (
        <ruby key={i}>
          {part.text}
          <rt style={{ fontSize: '0.4em', fontFamily: jaFont, letterSpacing: TRACKING, paddingBottom: '0.25em' }}>{part.furigana}</rt>
        </ruby>
      ) : <span key={i}>{part.text}</span>)}
    </span>
  )
}

function PreviewFace({ face, settings, context }) {
  const jaFont = settings.pixelFont ? FONT : 'system-ui, sans-serif'
  const front = face === 'front'
  const sentence = settings.sentence && context.id !== 'word-import' ? WORD.sentence : null
  const chars = Object.keys(WORD.kanjiMeanings)

  return (
    <div style={{
      width: 240, height: 150, background: CARD_BG, borderRadius: 6,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: settings.visualEffects ? '0 6px 18px rgba(0,0,0,0.35)' : 'none',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACE_4, padding: `0 ${SPACE_12}px` }}>
        <div style={{ fontSize: front ? 34 : 26, color: '#222', lineHeight: 1.3, letterSpacing: 'normal' }}>
          <Ruby text={WORD.form} reading={WORD.reading} jaFont={jaFont} show={front ? settings.furigana : true} />
        </div>
        {!front && settings.translation && (
          <div style={{ fontFamily: FONT, fontSize: 13, color: '#444' }}>{WORD.english}</div>
        )}
        {!front && sentence && (
          <div style={{ fontFamily: jaFont, fontSize: 11, color: '#555', textAlign: 'center', letterSpacing: 'normal' }}>{sentence}</div>
        )}
      </div>
      {!front && settings.kanjiMeanings && (
        <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.14)', background: 'rgba(0,0,0,0.035)' }}>
          {chars.map((ch, i) => (
            <div key={ch} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              padding: '5px 4px', borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
            }}>
              <span style={{ fontFamily: jaFont, fontSize: 14, color: '#333' }}>{ch}</span>
              <span style={{ fontFamily: FONT, fontSize: 9, color: '#777' }}>{WORD.kanjiMeanings[ch]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Preview({ settings, context, children }) {
  const speaking = settings.audio && (context.audio === 'voicevox' || settings.voice === 'browser')
  const voiceLabel = VOICE_OPTIONS.find(v => v.value === settings.voice)?.label
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE_16 }}>
      <div style={{ display: 'flex', gap: SPACE_16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['front', 'back'].map(face => (
          <div key={face} style={{ display: 'flex', flexDirection: 'column', gap: SPACE_8, alignItems: 'center' }}>
            <PreviewFace face={face} settings={settings} context={context} />
            <span style={{ ...SUBHEADING_STYLE, fontSize: FS_BADGE, color: 'rgba(255,255,255,0.3)' }}>{face}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8, color: TEXT_MUTED, fontSize: FS_SM, textAlign: 'center' }}>
        <SpeakerIcon muted={!speaking} size={16} />
        {!settings.audio
          ? 'Audio off'
          : context.audio === 'none' && settings.voice !== 'browser'
            ? 'No recording for this word — the browser voice reads it'
            : voiceLabel}
      </div>
      {children}
    </div>
  )
}

// ── Shared row pieces ───────────────────────────────────────────────────
// FilterCard's own FilterRow was considered and rejected here: its 92px
// fixed label column is sized for short filter labels ("Content", "JLPT"),
// and wraps settings labels onto two lines. Same container, different row.
function Row({ label, hint, badge, control, indent = 0 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE_12,
      padding: `10px ${SPACE_16}px`, paddingLeft: SPACE_16 + indent * 18,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8 }}>
          <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>{label}</span>
          {badge}
        </div>
        {hint && <span style={{ fontSize: FS_SM, color: 'rgba(255,255,255,0.35)' }}>{hint}</span>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  )
}

function GroupLabel({ children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE_12, margin: `${SPACE_24}px 0 ${SPACE_8}px` }}>
      <span style={{ ...SUBHEADING_STYLE, color: 'rgba(255,255,255,0.35)' }}>{children}</span>
      {note && <span style={{ fontSize: FS_SM, color: 'rgba(255,255,255,0.25)' }}>{note}</span>}
    </div>
  )
}

function Switch({ on, onChange, disabled }) {
  return <ToggleButton active={on} labels={{ on: 'On', off: 'Off' }} onClick={onChange} disabled={disabled} />
}

// What this list genuinely cannot offer — the panel should say so rather than
// present a switch that resolves to nothing.
function unavailable(key, context) {
  if (context.id !== 'word-import') return null
  if (key === 'sentence') return 'No curated sentences in this deck'
  return null
}

// ── Variant 0 — today ───────────────────────────────────────────────────
function TodayPanel({ s, set }) {
  return (
    <div style={{ padding: SPACE_16 }}>
      <SectionHeader title="Settings" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Checkbox checked={s.streak} onChange={() => set('streak', !s.streak)} label="Show streak" />
        <Checkbox checked={s.furigana} onChange={() => set('furigana', !s.furigana)} label="Show furigana" />
        <Checkbox checked={s.visualEffects} onChange={() => set('visualEffects', !s.visualEffects)} label="Show visual effects" />
        <Checkbox checked={s.pixelFont} onChange={() => set('pixelFont', !s.pixelFont)} label="Use pixel font" />
        <Checkbox checked={s.translation} onChange={() => set('translation', !s.translation)} label="Show translation" />
        <Checkbox checked={s.sentence} onChange={() => set('sentence', !s.sentence)} label="Show sentence" />
        {s.sentence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_4, paddingLeft: 20 }}>
            <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)' }}>Sentence source</span>
            <Select value={s.sentenceSource} onChange={v => set('sentenceSource', v)} options={SENTENCE_SOURCE_OPTIONS} label="Sentence source" />
          </div>
        )}
        <Checkbox checked={s.kanjiMeanings} onChange={() => set('kanjiMeanings', !s.kanjiMeanings)} label="Show kanji meaning" />
        <Checkbox checked={s.audio} onChange={() => set('audio', !s.audio)} label="Enable audio" />
        {s.audio && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_4, paddingLeft: 20 }}>
              <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)' }}>Text to speech</span>
              <Select value={s.voice} onChange={v => set('voice', v)} options={VOICE_OPTIONS} label="Text to speech" />
            </div>
            <Checkbox checked={s.sfx} onChange={() => set('sfx', !s.sfx)} label="Sound effects" subtext="Silent mode may mute sound effects" indent={1} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Variant 1 — card anatomy ────────────────────────────────────────────
function AnatomyPanel({ s, set, context }) {
  const noSentence = unavailable('sentence', context)
  return (
    <div style={{ padding: SPACE_16 }}>
      <GroupLabel note="what you see first">Card front</GroupLabel>
      <FilterCard>
        <Row label="Furigana" hint="Reading above the kanji" control={<Switch on={s.furigana} onChange={() => set('furigana', !s.furigana)} />} />
      </FilterCard>

      <GroupLabel note="what the answer shows">Card back</GroupLabel>
      <FilterCard>
        <Row label="Meaning" control={<Switch on={s.translation} onChange={() => set('translation', !s.translation)} />} />
        <Row label="Kanji breakdown" hint="Per-character meaning strip" control={<Switch on={s.kanjiMeanings} onChange={() => set('kanjiMeanings', !s.kanjiMeanings)} />} />
        <Row
          label="Example sentence"
          hint={noSentence}
          control={<Switch on={s.sentence && !noSentence} onChange={() => set('sentence', !s.sentence)} disabled={!!noSentence} />}
        />
        {s.sentence && !noSentence && (
          <Row indent={1} label="Sentence from" control={<Select value={s.sentenceSource} onChange={v => set('sentenceSource', v)} options={SENTENCE_SOURCE_OPTIONS} label="Sentence source" />} />
        )}
      </FilterCard>

      <GroupLabel>Audio</GroupLabel>
      <FilterCard>
        <Row label="Word audio" control={<Switch on={s.audio} onChange={() => set('audio', !s.audio)} />} />
        {s.audio && (
          <Row
            indent={1}
            label="Voice"
            hint={context.audio === 'none' ? 'This deck has no recordings — the browser voice reads it' : null}
            control={<Select value={s.voice} onChange={v => set('voice', v)} options={VOICE_OPTIONS} label="Voice" />}
          />
        )}
        {s.audio && (
          <Row indent={1} label="Play automatically" control={
            <ChipSelector
              mode="multi"
              value={new Set([...(s.autoplayFront ? ['front'] : []), ...(s.autoplayBack ? ['back'] : [])])}
              onChange={next => { set('autoplayFront', next.has('front')); set('autoplayBack', next.has('back')) }}
              options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]}
            />
          } />
        )}
      </FilterCard>

      <GroupLabel note="not about the card">Interface</GroupLabel>
      <FilterCard>
        <Row label="Sound effects" hint="Flip and answer clicks" control={<Switch on={s.sfx} onChange={() => set('sfx', !s.sfx)} />} />
        <Row label="Pixel font" control={<Switch on={s.pixelFont} onChange={() => set('pixelFont', !s.pixelFont)} />} />
        <Row label="Visual effects" control={<Switch on={s.visualEffects} onChange={() => set('visualEffects', !s.visualEffects)} />} />
        <Row label="Streak counter" control={<Switch on={s.streak} onChange={() => set('streak', !s.streak)} />} />
      </FilterCard>
    </div>
  )
}

// ── Variant 2 — tabs ────────────────────────────────────────────────────
const TABS = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'audio', label: 'Audio' },
  { value: 'app', label: 'App' },
]

function TabsPanel({ s, set, context }) {
  const [tab, setTab] = useState('front')
  const noSentence = unavailable('sentence', context)
  return (
    <div style={{ padding: SPACE_16 }}>
      <ChipSelector mode="single" size="md" grow value={tab} onChange={setTab} options={TABS} />
      <div style={{ marginTop: SPACE_16 }}>
        {tab === 'front' && (
          <FilterCard>
            <Row label="Furigana" hint="Reading above the kanji" control={<Switch on={s.furigana} onChange={() => set('furigana', !s.furigana)} />} />
            <Row label="Pixel font" control={<Switch on={s.pixelFont} onChange={() => set('pixelFont', !s.pixelFont)} />} />
          </FilterCard>
        )}
        {tab === 'back' && (
          <FilterCard>
            <Row label="Meaning" control={<Switch on={s.translation} onChange={() => set('translation', !s.translation)} />} />
            <Row label="Kanji breakdown" control={<Switch on={s.kanjiMeanings} onChange={() => set('kanjiMeanings', !s.kanjiMeanings)} />} />
            <Row label="Example sentence" hint={noSentence} control={<Switch on={s.sentence && !noSentence} onChange={() => set('sentence', !s.sentence)} disabled={!!noSentence} />} />
            {s.sentence && !noSentence && (
              <Row indent={1} label="Sentence from" control={<Select value={s.sentenceSource} onChange={v => set('sentenceSource', v)} options={SENTENCE_SOURCE_OPTIONS} label="Sentence source" />} />
            )}
          </FilterCard>
        )}
        {tab === 'audio' && (
          <FilterCard>
            <Row label="Word audio" control={<Switch on={s.audio} onChange={() => set('audio', !s.audio)} />} />
            <Row indent={1} label="Voice" hint={context.audio === 'none' ? 'No recordings in this deck' : null} control={<Select value={s.voice} onChange={v => set('voice', v)} options={VOICE_OPTIONS} label="Voice" />} />
            <Row indent={1} label="Autoplay front" control={<Switch on={s.autoplayFront} onChange={() => set('autoplayFront', !s.autoplayFront)} />} />
            <Row indent={1} label="Autoplay back" control={<Switch on={s.autoplayBack} onChange={() => set('autoplayBack', !s.autoplayBack)} />} />
            <Row label="Sound effects" hint="Interface clicks, not the word" control={<Switch on={s.sfx} onChange={() => set('sfx', !s.sfx)} />} />
          </FilterCard>
        )}
        {tab === 'app' && (
          <FilterCard>
            <Row label="Visual effects" control={<Switch on={s.visualEffects} onChange={() => set('visualEffects', !s.visualEffects)} />} />
            <Row label="Streak counter" control={<Switch on={s.streak} onChange={() => set('streak', !s.streak)} />} />
          </FilterCard>
        )}
      </div>
    </div>
  )
}

// ── Variant 3 — presets and per-list recommendations ────────────────────
function RecommendedBadge() {
  return <Badge tone="accent" variant="text">recommended</Badge>
}

function PresetPanel({ s, set, setMany, context, preset, setPreset }) {
  const rec = context.recommended
  const offSpec = Object.entries(rec).filter(([k, v]) => s[k] !== v)
  const noSentence = unavailable('sentence', context)

  function applyPreset(id) {
    setPreset(id)
    setMany(id === 'recommended' ? rec : PRESETS[id].values)
  }

  function touch(key, value) {
    setPreset('custom')
    set(key, value)
  }

  function row(key, label, hint, control) {
    return (
      <Row
        label={label}
        hint={hint}
        badge={key in rec && s[key] === rec[key] ? <RecommendedBadge /> : null}
        control={control}
      />
    )
  }

  return (
    <div style={{ padding: SPACE_16 }}>
      <SectionHeader title={`Preset for ${context.label}`} />
      <ChipSelector
        mode="single"
        value={preset}
        onChange={applyPreset}
        options={[...Object.entries(PRESETS).map(([id, p]) => ({ value: id, label: p.label })), { value: 'custom', label: 'Custom' }]}
      />
      <div style={{ fontSize: FS_SM, color: 'rgba(255,255,255,0.35)', marginTop: SPACE_8 }}>
        {preset === 'custom' ? 'Your own combination' : PRESETS[preset]?.hint}
      </div>

      {offSpec.length > 0 && (
        <div style={{ marginTop: SPACE_16 }}>
          <Notice tone="neutral" title={`${context.label} is set up differently`}>
            <div style={{ marginBottom: SPACE_8 }}>{context.why}</div>
            <Button variant="accent-outline" size="sm" onClick={() => applyPreset('recommended')}>
              Use this list&apos;s settings
            </Button>
          </Notice>
        </div>
      )}

      <GroupLabel>Card front</GroupLabel>
      <FilterCard>
        {row('furigana', 'Furigana', 'Reading above the kanji', <Switch on={s.furigana} onChange={() => touch('furigana', !s.furigana)} />)}
      </FilterCard>

      <GroupLabel>Card back</GroupLabel>
      <FilterCard>
        {row('translation', 'Meaning', null, <Switch on={s.translation} onChange={() => touch('translation', !s.translation)} />)}
        {row('kanjiMeanings', 'Kanji breakdown', null, <Switch on={s.kanjiMeanings} onChange={() => touch('kanjiMeanings', !s.kanjiMeanings)} />)}
        {row('sentence', 'Example sentence', noSentence, <Switch on={s.sentence && !noSentence} disabled={!!noSentence} onChange={() => touch('sentence', !s.sentence)} />)}
      </FilterCard>

      <GroupLabel>Audio</GroupLabel>
      <FilterCard>
        <Row label="Word audio" control={<Switch on={s.audio} onChange={() => touch('audio', !s.audio)} />} />
        {s.audio && (
          <Row
            indent={1}
            label="Voice"
            badge={s.voice === rec.voice ? <RecommendedBadge /> : null}
            hint={context.audio === 'none' ? 'This deck has no recordings' : null}
            control={<Select value={s.voice} onChange={v => touch('voice', v)} options={VOICE_OPTIONS} label="Voice" />}
          />
        )}
        <Row label="Sound effects" control={<Switch on={s.sfx} onChange={() => set('sfx', !s.sfx)} />} />
      </FilterCard>

      <GroupLabel note="same on every list">Interface</GroupLabel>
      <FilterCard>
        <Row label="Pixel font" control={<Switch on={s.pixelFont} onChange={() => set('pixelFont', !s.pixelFont)} />} />
        <Row label="Visual effects" control={<Switch on={s.visualEffects} onChange={() => set('visualEffects', !s.visualEffects)} />} />
        <Row label="Streak counter" control={<Switch on={s.streak} onChange={() => set('streak', !s.streak)} />} />
      </FilterCard>
    </div>
  )
}

// ── Variant 4 — on the card itself ──────────────────────────────────────
const CARD_TOGGLES = [
  { key: 'furigana', glyph: 'ふ', label: 'Furigana', face: 'front' },
  { key: 'translation', glyph: 'EN', label: 'Meaning', face: 'back' },
  { key: 'kanjiMeanings', glyph: '漢', label: 'Kanji', face: 'back' },
  { key: 'sentence', glyph: '文', label: 'Sentence', face: 'back' },
]

function CardToolbar({ s, set, context }) {
  return (
    <div style={{ display: 'flex', gap: SPACE_8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      {CARD_TOGGLES.map(t => {
        const blocked = !!unavailable(t.key, context)
        return (
          <Chip
            key={t.key}
            active={s[t.key] && !blocked}
            disabled={blocked}
            onClick={() => set(t.key, !s[t.key])}
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE_4 }}>
                <span style={{ fontSize: FS_BASE }}>{t.glyph}</span>
                <span style={{ fontSize: FS_BADGE, opacity: 0.7 }}>{t.face}</span>
              </span>
            }
          />
        )
      })}
      <Chip
        active={s.audio}
        onClick={() => set('audio', !s.audio)}
        label={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE_4 }}>
            <SpeakerIcon muted={!s.audio} size={14} />
            {s.voice === 'browser' ? 'browser' : s.voice === 'voicevox-2' ? 'female' : 'male'}
          </span>
        }
      />
    </div>
  )
}

function OnCardPanel({ s, set }) {
  return (
    <div style={{ padding: SPACE_16 }}>
      <Notice tone="neutral" title="The toggles moved onto the card">
        Everything that changes what a card shows lives in the strip under the card, visible while drilling —
        one click, no drawer, and the result is directly above the control. The drawer keeps only what you set
        once and forget.
      </Notice>
      <GroupLabel>Set once</GroupLabel>
      <FilterCard>
        <Row label="Voice" control={<Select value={s.voice} onChange={v => set('voice', v)} options={VOICE_OPTIONS} label="Voice" />} />
        <Row label="Autoplay front" control={<Switch on={s.autoplayFront} onChange={() => set('autoplayFront', !s.autoplayFront)} />} />
        <Row label="Autoplay back" control={<Switch on={s.autoplayBack} onChange={() => set('autoplayBack', !s.autoplayBack)} />} />
        <Row label="Sentence from" control={<Select value={s.sentenceSource} onChange={v => set('sentenceSource', v)} options={SENTENCE_SOURCE_OPTIONS} label="Sentence source" />} />
        <Row label="Sound effects" control={<Switch on={s.sfx} onChange={() => set('sfx', !s.sfx)} />} />
        <Row label="Pixel font" control={<Switch on={s.pixelFont} onChange={() => set('pixelFont', !s.pixelFont)} />} />
        <Row label="Visual effects" control={<Switch on={s.visualEffects} onChange={() => set('visualEffects', !s.visualEffects)} />} />
        <Row label="Streak counter" control={<Switch on={s.streak} onChange={() => set('streak', !s.streak)} />} />
      </FilterCard>
    </div>
  )
}

const VARIANTS = [
  {
    id: 'today',
    label: 'Today',
    title: 'What ships now',
    blurb: 'Twelve controls in one column, all rendered identically, ordered by when each was added. Nesting appears and disappears as you toggle, so the list changes height under the cursor.',
    fixes: null,
    costs: null,
    Panel: TodayPanel,
  },
  {
    id: 'anatomy',
    label: 'Card anatomy',
    title: 'Grouped by where it appears',
    blurb: 'The four subjects the flat list mixes together, named and separated: what the front shows, what the back shows, audio, and app chrome. Each row is a label with its current value on the right, so the panel reads at a glance instead of being decoded checkbox by checkbox.',
    fixes: 'Answers "where does this show up?" without flipping a card. Sound effects stop being a child of word audio — they are interface feedback, not the word being read. Settings a list cannot honour say so instead of lying.',
    costs: 'Taller than the checkbox column, so mobile scrolls more. Four boxes is more chrome than one list.',
    Panel: AnatomyPanel,
  },
  {
    id: 'tabs',
    label: 'Tabs',
    title: 'One group at a time',
    blurb: 'The same grouping, but only one group on screen at once. Nothing scrolls and the panel height stops moving.',
    fixes: 'Fits a phone without scrolling, and makes the front/back split the primary navigation.',
    costs: 'You can no longer see the whole configuration at once, and changing two things in different groups takes a detour. Four tabs is a lot of navigation for twelve settings.',
    Panel: TabsPanel,
  },
  {
    id: 'presets',
    label: 'Presets + list defaults',
    title: 'The list knows what it wants',
    blurb: 'Each word list carries a recommended configuration. Genki 1 opens with furigana on; So-Matome N2 opens with it off, because at N2 the reading is the thing being tested. Named presets sit above the rows for people who want a different mode entirely, and any manual change drops the preset to Custom.',
    fixes: 'Directly answers the defaults problem — a new list no longer inherits whatever you last used on an unrelated one. A row marked "recommended" says the value is deliberate rather than leftover.',
    costs: 'Someone has to author the recommendation per list. It also needs a rule for switching lists mid-habit: silently re-applying would be hostile, so this variant only offers it.',
    Panel: PresetPanel,
  },
  {
    id: 'oncard',
    label: 'On the card',
    title: 'No drawer for what you change mid-session',
    blurb: 'Card-content toggles become a strip under the card, live during the drill. The drawer keeps only set-once preferences. Each chip says which face it affects.',
    fixes: 'Zero navigation for the four settings you actually flip while studying, with the effect visible immediately above the control. Kills the open-drawer, toggle, close-drawer, flip-card, "was that right?" loop.',
    costs: 'Adds permanent chrome under the card, competing with the answer buttons for attention. Needs a more compact treatment on mobile.',
    Panel: OnCardPanel,
  },
]

const PROBLEMS = [
  ['One list, four subjects', 'Front content, back content, audio and app chrome are interleaved in a single column with no separation. "Show furigana" (front), "Use pixel font" (chrome) and "Show sentence" (back) sit adjacent and look identical.'],
  ['Every control is the same shape', 'Twelve checkboxes means twelve identical rows. Nothing signals which settings change what you are tested on and which are purely cosmetic.'],
  ['Nesting by disappearance', 'Sentence source, voice and sound effects only exist while their parent is checked, so the list grows and shrinks under the cursor and the panel never has a stable shape.'],
  ['Sound effects live under audio', 'Interface clicks are nested inside "Enable audio", so silencing the spoken word also hides the control for the button sounds. They are unrelated concerns.'],
  ['No preview', 'You toggle blind, then flip a card to see what changed — while the card is right there on screen.'],
  ['Defaults are global, but the right answer is per-list', 'A beginner list wants furigana on the front; an N2 vocabulary list wants it off, because there the reading is the answer. One shared switch cannot be right for both.'],
  ['The audio picker names a technology, not a decision', '"Text to speech: Browser TTS" asks the learner to know what Voicevox is. It also hides the real behaviour: a word with no generated file silently falls back to the browser voice.'],
  ['Three copies', 'Vocab Drill, Vocab SRS and Anime Vocab each render their own near-identical version of this list, and the labels have already drifted ("Show furigana" vs "Show furigana on front").'],
]

export default function SettingsLabPage({ initialVariant = 'anatomy', initialContext = 'genki-1' }) {
  const [variantId, setVariantId] = useState(initialVariant)
  const [contextId, setContextId] = useState(initialContext)
  const [settings, setSettings] = useState(DEFAULTS)
  const [preset, setPreset] = useState('custom')

  const variant = VARIANTS.find(v => v.id === variantId)
  const context = CONTEXTS.find(c => c.id === contextId)
  const Panel = variant.Panel

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))
  const setMany = values => setSettings(prev => ({ ...prev, ...values }))

  return (
    <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Settings lab' }]} />
      <main className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: `${SPACE_24}px ${SPACE_24}px 80px` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>

          <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>Drill settings — a rethink</div>
          <p style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.6, maxWidth: 720, margin: `0 0 ${SPACE_24}px` }}>
            Five layouts for the same set of settings, all driven by one live state and previewed against a real
            card. Switch the pretend word list to see how each one handles defaults that should differ per list,
            and a deck with no generated audio.
          </p>

          <GroupLabel>What is wrong with the list today</GroupLabel>
          <Card padding={0}>
            {PROBLEMS.map(([title, body], i) => (
              <div key={title} style={{ padding: `${SPACE_12}px ${SPACE_16}px`, borderTop: i > 0 ? `1px solid ${HAIRLINE}` : 'none' }}>
                <div style={{ fontSize: FS_BASE, marginBottom: SPACE_4 }}>{title}</div>
                <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.55 }}>{body}</div>
              </div>
            ))}
          </Card>

          <GroupLabel>Pretend context</GroupLabel>
          <Card>
            <ChipSelector
              mode="single"
              value={contextId}
              onChange={setContextId}
              options={CONTEXTS.map(c => ({ value: c.id, label: c.label }))}
            />
            <div style={{ marginTop: SPACE_12, fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.55 }}>
              <div style={{ color: TEXT }}>{context.meta}</div>
              <div style={{ marginTop: SPACE_4 }}>{context.why}</div>
            </div>
          </Card>

          <GroupLabel>Layout</GroupLabel>
          <ChipSelector
            mode="single"
            size="md"
            value={variantId}
            onChange={setVariantId}
            options={VARIANTS.map(v => ({ value: v.id, label: v.label }))}
          />

          <div style={{ marginTop: SPACE_24, display: 'flex', gap: SPACE_32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: 300 }}>
              <div style={{ fontSize: FS_CONTENT_HEADING, marginBottom: SPACE_8 }}>{variant.title}</div>
              <p style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.6, margin: `0 0 ${SPACE_16}px` }}>{variant.blurb}</p>
              {variant.fixes && (
                <Card style={{ marginBottom: SPACE_12 }}>
                  <div style={{ ...SUBHEADING_STYLE, fontSize: FS_BADGE, color: 'rgba(255,255,255,0.35)', marginBottom: SPACE_4 }}>Fixes</div>
                  <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.55 }}>{variant.fixes}</div>
                </Card>
              )}
              {variant.costs && (
                <Card>
                  <div style={{ ...SUBHEADING_STYLE, fontSize: FS_BADGE, color: 'rgba(255,255,255,0.35)', marginBottom: SPACE_4 }}>Costs</div>
                  <div style={{ fontSize: FS_SM, color: TEXT_MUTED, lineHeight: 1.55 }}>{variant.costs}</div>
                </Card>
              )}
              <div style={{ marginTop: SPACE_24 }}>
                <Preview settings={settings} context={context}>
                  {variantId === 'oncard' && <CardToolbar s={settings} set={set} context={context} />}
                </Preview>
              </div>
            </div>

            <div style={{
              width: PANEL_W, flexShrink: 0, background: SURFACE,
              border: `1px solid ${HAIRLINE}`, borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ ...SUBHEADING_STYLE, padding: `${SPACE_8}px ${SPACE_16}px`, borderBottom: `1px solid ${HAIRLINE}`, fontSize: FS_BADGE, color: 'rgba(255,255,255,0.3)' }}>
                Sidebar · {PANEL_W}px
              </div>
              <Panel
                s={settings}
                set={set}
                setMany={setMany}
                context={context}
                preset={preset}
                setPreset={setPreset}
              />
            </div>
          </div>

          <GroupLabel>If you take one thing from this</GroupLabel>
          <Card>
            <div style={{ fontSize: FS_BASE, lineHeight: 1.6, color: TEXT_MUTED }}>
              <p style={{ margin: `0 0 ${SPACE_12}px` }}>
                <span style={{ color: TEXT }}>Card anatomy is the base.</span> Grouping by front / back / audio /
                interface is the change that makes every other idea possible, and it costs nothing but layout.
              </p>
              <p style={{ margin: `0 0 ${SPACE_12}px` }}>
                <span style={{ color: TEXT }}>Per-list recommendations bolt onto it.</span> A
                {' '}<code style={{ fontSize: FS_SM }}>recommended</code> object on each entry in
                {' '}<code style={{ fontSize: FS_SM }}>wordLists.js</code> (or per textbook), applied when a list is
                first opened and offered — never forced — afterwards.
              </p>
              <p style={{ margin: `0 0 ${SPACE_12}px` }}>
                <span style={{ color: TEXT }}>Audio should describe voices, not vendors.</span> Male / Female /
                Browser, with a line stating that words without a recording use the browser voice. That is already
                what the code does; the panel just never says so.
              </p>
              <p style={{ margin: 0 }}>
                <span style={{ color: TEXT }}>Whichever wins, it should be one component.</span> A single
                {' '}<code style={{ fontSize: FS_SM }}>DrillSettingsPanel</code> taking a value object and a change
                handler, shared by Vocab Drill, SRS and Anime Vocab, ends the three-way drift.
              </p>
            </div>
          </Card>

        </div>
      </main>
    </div>
  )
}
