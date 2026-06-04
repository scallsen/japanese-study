export default function DrawerSectionHeader({ title, hasSelections, onClearAll, fontSize = 13 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </span>
      {hasSelections && onClearAll && (
        <button
          onClick={onClearAll}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
        >
          Deselect all
        </button>
      )}
    </div>
  )
}
