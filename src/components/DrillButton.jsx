import { FONT, TRACKING, FS_BASE, FS_CAPTION, SPACE_8, DRILL_ROW_WIDTH, DRILL_ROW_HEIGHT } from '../data/theme.js'

/**
 * One judgment button in a drill. Consolidates two components that were the
 * same control wearing different labels: SpeedModeControls' Correct/Incorrect
 * pair and VocabSrsDrill's four-way `RatingButton`. Both already shared the
 * `.verdict-btn` class, the 380px row width, radius 8, white-on-solid fill,
 * and gap — they differed only in padding (10px vs 8px) and fill opacity
 * (0.85 vs 0.75), reconciled to 8px padding + 0.85 opacity (the
 * higher-contrast of the two). A fixed `DRILL_ROW_HEIGHT` (not padding-driven
 * auto height) is what keeps this identical in height to the pre-flip
 * placeholder in `DrillButtonRow` below — a `sublabel` second line (the FSRS
 * interval preview) used to make this row taller than the placeholder,
 * shifting the card on flip. That preview is gone from the SRS drill for the
 * same reason: label + hint + interval routinely wrapped a single button's
 * text across two lines even without a sublabel.
 */
export function DrillButton({ label, hint, color, onClick, disabled = false, flex = 1 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="verdict-btn"
      style={{
        flex,
        height: DRILL_ROW_HEIGHT,
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
      {hint && <span style={{ opacity: 0.6, fontSize: FS_CAPTION }}> [{hint}]</span>}
    </button>
  )
}

// The row DrillButtons sit in, plus the pre-flip placeholder that occupies
// the same slot so the layout doesn't jump when the card flips. Both are
// pinned to DRILL_ROW_HEIGHT so that's true regardless of content.
export default function DrillButtonRow({ children, placeholder }) {
  if (placeholder) {
    return (
      <div style={{
        width: DRILL_ROW_WIDTH, height: DRILL_ROW_HEIGHT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.25)', fontSize: FS_BASE,
        fontFamily: FONT, letterSpacing: TRACKING,
      }}>
        {placeholder}
      </div>
    )
  }

  return (
    <div style={{ width: DRILL_ROW_WIDTH, height: DRILL_ROW_HEIGHT, display: 'flex', gap: SPACE_8 }}>
      {children}
    </div>
  )
}
