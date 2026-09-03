import { SUBHEADING_STYLE, FS_BASE } from '../data/theme.js'

// Uppercase section title with an optional control on the right. `action`
// is any node (VocabPage's DoneScreen puts a DeckComboBox there, Anime
// Vocab's EpisodeDrill a Button); `hasSelections`/`onClearAll` is the older
// settings-drawer "Deselect all" text button, kept as-is for those callers.
export default function SectionHeader({ title, action, hasSelections, onClearAll }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ ...SUBHEADING_STYLE, color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>
        {title}
      </span>
      {action}
      {!action && hasSelections && onClearAll && (
        <button
          onClick={onClearAll}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: FS_BASE, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
        >
          Deselect all
        </button>
      )}
    </div>
  )
}
