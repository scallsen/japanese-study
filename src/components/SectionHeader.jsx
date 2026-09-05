import { FONT, SUBHEADING_STYLE, FS_BASE } from '../data/theme.js'

// Uppercase section title with an optional control on the right. `action`
// is any node (VocabPage's DoneScreen puts a DeckComboBox there, Anime
// Vocab's EpisodeDrill a Button); `hasSelections`/`onClearAll` is the older
// settings-drawer "Deselect all" text button, kept as-is for those callers.
// `marginTop` came from the retired SectionLabel — the in-page group dividers
// it used to draw (Dictionary, Vocab Drill preview) need the extra separation
// from the block above where a drawer/done-screen heading doesn't.
export default function SectionHeader({ title, action, hasSelections, onClearAll, marginTop = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ ...SUBHEADING_STYLE, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>
        {title}
      </span>
      {action}
      {!action && hasSelections && onClearAll && (
        <button
          onClick={onClearAll}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: FS_BASE, fontFamily: FONT, cursor: 'pointer', padding: 0 }}
        >
          Deselect all
        </button>
      )}
    </div>
  )
}
