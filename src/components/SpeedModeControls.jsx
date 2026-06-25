import { FS_BASE } from '../data/theme.js'

export default function SpeedModeControls({ isFlipped, transitioning, onVerdict }) {
  if (!isFlipped) {
    return (
      <div style={{
        width: 'min(380px, calc(100vw - 32px))',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.25)',
        fontSize: FS_BASE,
        fontFamily: 'inherit',
        letterSpacing: '0.05em',
        padding: '10px 0',
      }}>
        Click to flip
      </div>
    )
  }

  return (
    <div style={{ width: 'min(380px, calc(100vw - 32px))', display: 'flex', gap: 8 }}>
      <button
        onClick={() => onVerdict(false)}
        disabled={transitioning}
        className="verdict-btn"
        style={{
          flex: 1,
          padding: '10px 0',
          fontSize: FS_BASE,
          fontFamily: 'inherit',
          background: 'rgba(192,57,43,0.85)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: transitioning ? 'default' : 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        Incorrect [Z]
      </button>
      <button
        onClick={() => onVerdict(true)}
        disabled={transitioning}
        className="verdict-btn"
        style={{
          flex: 1,
          padding: '10px 0',
          fontSize: FS_BASE,
          fontFamily: 'inherit',
          background: 'rgba(39,174,96,0.85)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: transitioning ? 'default' : 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        Correct [X]
      </button>
    </div>
  )
}
