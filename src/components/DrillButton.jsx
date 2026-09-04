import { FONT, TRACKING, FS_BASE, FS_CAPTION, SPACE_8, DRILL_ROW_WIDTH } from '../data/theme.js'

/**
 * One judgment button in a drill. Consolidates two components that were the
 * same control wearing different labels: SpeedModeControls' Correct/Incorrect
 * pair and VocabSrsDrill's four-way `RatingButton`. Both already shared the
 * `.verdict-btn` class, the 380px row width, radius 8, white-on-solid fill,
 * and gap — they differed only in padding (10px vs 8px), fill opacity
 * (0.85 vs 0.75), and whether a second line was rendered.
 *
 * Reconciled to 8px padding + 0.85 opacity (the higher-contrast of the two)
 * and an optional `sublabel`, which is what the FSRS interval preview needs
 * and the speed-mode pair simply omits.
 */
export function DrillButton({ label, hint, sublabel, color, onClick, disabled = false, flex = 1 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="verdict-btn"
      style={{
        flex,
        padding: `${SPACE_8}px 0`,
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}
    >
      <span>
        {label}
        {hint && <span style={{ opacity: 0.6, fontSize: FS_CAPTION }}> [{hint}]</span>}
      </span>
      {sublabel && <span style={{ fontSize: FS_CAPTION, opacity: 0.65 }}>{sublabel}</span>}
    </button>
  )
}

// The row DrillButtons sit in, plus the pre-flip placeholder that occupies
// the same slot so the layout doesn't jump when the card flips.
export default function DrillButtonRow({ children, placeholder }) {
  if (placeholder) {
    return (
      <div style={{
        width: DRILL_ROW_WIDTH, textAlign: 'center',
        color: 'rgba(255,255,255,0.25)', fontSize: FS_BASE,
        fontFamily: FONT, letterSpacing: TRACKING, padding: '10px 0',
      }}>
        {placeholder}
      </div>
    )
  }

  return (
    <div style={{ width: DRILL_ROW_WIDTH, display: 'flex', gap: SPACE_8 }}>
      {children}
    </div>
  )
}
