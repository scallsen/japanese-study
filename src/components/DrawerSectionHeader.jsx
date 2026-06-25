import { SUBHEADING_STYLE, FS_BASE } from '../data/theme.js'

export default function DrawerSectionHeader({ title, hasSelections, onClearAll }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ ...SUBHEADING_STYLE, color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit' }}>
        {title}
      </span>
      {hasSelections && onClearAll && (
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
