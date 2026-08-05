import { FS_BASE, TRACKING } from '../data/theme.js'

const OPTIONS = [
  { value: 'kanji-front', label: 'Japanese → English' },
  { value: 'meaning-front', label: 'English → Japanese' },
]

export default function VocabModeToggle({ mode, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {OPTIONS.map(opt => {
        const active = mode === opt.value
        return (
          <button
            key={opt.value}
            className={`vocab-mode-btn ${active ? 'vocab-mode-btn--active' : ''}`}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: FS_BASE,
              fontFamily: 'inherit',
              letterSpacing: TRACKING,
              borderRadius: 8,
              cursor: 'pointer',
              border: `1px solid ${active ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.15)'}`,
              color: active ? '#3ABDA4' : 'rgba(255,255,255,0.6)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
