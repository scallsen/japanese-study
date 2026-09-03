import { FONT, KANJI_FONT, TRACKING, BORDER, TEXT, FS_BASE } from '../../data/theme.js'

export { KANJI_FONT }
export const ACCENT = '#CC8A3D'
export const BG = '#1E1E1E'
export const SURFACE = '#2A2A2A'

export function Button({ onClick, disabled, primary, children }) {
  return (
    <button
      className="story-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONT,
        letterSpacing: TRACKING,
        fontSize: FS_BASE,
        padding: '10px 18px',
        borderRadius: 4,
        border: `1px solid ${primary ? ACCENT : BORDER}`,
        background: primary ? ACCENT : SURFACE,
        color: primary ? '#1E1E1E' : TEXT,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
