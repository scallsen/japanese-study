import Switch from './Switch.jsx'
import Select from './Select.jsx'
import FilterCard from './FilterCard.jsx'
import ChipSelector from './Chip.jsx'
import {
  FONT, TRACKING, TEXT, FS_BASE, FS_CAPTION, SUBHEADING_STYLE,
  SPACE_8, SPACE_12, SPACE_16, SPACE_24,
} from '../data/theme.js'

// The drill settings drawer, shared by Vocab Drill, Anime Vocab and SRS.
//
// Grouped by the part of the card each setting changes, because that is the
// question being asked when the drawer is opened. Audio is not a group of its
// own: playing the word is one of the things a face does, so it is a row in
// both faces, and the audio group keeps only the genuinely global decision of
// which voice speaks.
//
// Every row sits at the same indent. A setting that only applies sometimes is
// sequenced by position and by appearing at all — a deck with no recordings
// has no Voice row, a device with no speech voices has no Backup voice row —
// so there is no explanatory text under any row.

const VOICE_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

// Exported for other settings-style panels (VocabSrsModule's overview) that
// want the same label-left/control-right row inside their own FilterCard,
// rather than a lookalike copy of this markup.
export function Row({ label, control, onActivate }) {
  return (
    <div
      onClick={onActivate}
      className={onActivate ? 'settings-row' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE_12,
        padding: `10px ${SPACE_16}px`,
        cursor: onActivate ? 'pointer' : undefined,
        userSelect: onActivate ? 'none' : undefined,
      }}
    >
      <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>{label}</span>
      {/* The row is the mouse hit target, so the control must not also
          receive the click and toggle it straight back. Keyboard users still
          reach the control itself — it keeps its own focus and its own
          role. */}
      <div style={{ flexShrink: 0, pointerEvents: onActivate ? 'none' : undefined }}>{control}</div>
    </div>
  )
}

// `footnote` renders inside the group rather than after it, so the stack's
// gap stays between groups and the credit stays attached to the rows it
// belongs to.
function Group({ label, footnote, children }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean)
  if (rows.length === 0) return null
  return (
    <div>
      <div style={{ marginBottom: SPACE_8 }}>
        <span style={{ ...SUBHEADING_STYLE, color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>{label}</span>
      </div>
      <FilterCard>{rows}</FilterCard>
      {footnote && (
        <div style={{ marginTop: SPACE_8, fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)' }}>
          {footnote}
        </div>
      )}
    </div>
  )
}

/**
 * @param {object}   settings           from useDrillSettings
 * @param {function} onChange           (key, value)
 * @param {boolean}  hasRecordedVoices  false hides the Voice row — Anime Vocab
 *                                      words have no recordings at all, so
 *                                      choosing between them decides nothing.
 * @param {array}    backupVoices       browser speech voices; empty hides the
 *                                      Backup voice row entirely.
 * @param {node}     audioFootnote      Voicevox attribution and the
 *                                      audio-generation notice. A licence
 *                                      credit, not help text — it sits under
 *                                      the group rather than under a row.
 * @param {node}     extraInterfaceRows module-specific rows (SRS drops its
 *                                      Hard/Easy toggle in here).
 */
export default function DrillSettingsPanel({
  settings,
  onChange,
  hasRecordedVoices = true,
  backupVoices = [],
  audioFootnote,
  extraInterfaceRows,
}) {
  function toggle(key) {
    return () => onChange(key, !settings[key])
  }

  function boolRow(key, label) {
    return (
      <Row
        key={key}
        label={label}
        onActivate={toggle(key)}
        control={<Switch checked={settings[key]} onChange={toggle(key)} label={label} />}
      />
    )
  }

  const showVoice = hasRecordedVoices
  const showBackupVoice = backupVoices.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_24 }}>
      <Group label="Card front">
        {boolRow('furigana', 'Furigana')}
        {boolRow('frontAudio', 'Audio')}
      </Group>

      <Group label="Card back">
        {boolRow('translation', 'Meaning')}
        {boolRow('kanjiMeanings', 'Kanji breakdown')}
        {boolRow('sentence', 'Sentence')}
        {boolRow('backAudio', 'Audio')}
      </Group>

      {(showVoice || showBackupVoice) && (
        <Group label="Audio" footnote={audioFootnote}>
          {showVoice && (
            <Row
              key="voice"
              label="Voice"
              control={<ChipSelector mode="single" value={settings.voice} onChange={v => onChange('voice', v)} options={VOICE_OPTIONS} />}
            />
          )}
          {showBackupVoice && (
            <Row
              key="backupVoice"
              label="Backup voice"
              control={
                <Select
                  value={settings.backupVoice}
                  onChange={v => onChange('backupVoice', v)}
                  options={[{ value: '', label: 'Device default' }, ...backupVoices.map(v => ({ value: v.name, label: v.name }))]}
                  label="Backup voice"
                />
              }
            />
          )}
        </Group>
      )}

      <Group label="Interface">
        {boolRow('sfx', 'Sound effects')}
        {boolRow('visualEffects', 'Visual effects')}
        {boolRow('pixelFont', 'Pixel font')}
        {boolRow('streak', 'Streak counter')}
        {extraInterfaceRows}
      </Group>
    </div>
  )
}
