import { FONT, TRACKING, TEXT, FS_BASE, SPACE_4, SPACE_8 } from '../data/theme.js'

// Matches the numeric-spinner styling already used identically (down to the
// exact padding/colors) at three separate call sites in VocabSrsModule plus
// EpisodeVocabBrowser's bulk-count input — extracted verbatim, not redesigned.
export default function NumberField({ value, onChange, min, max, width = 60, disabled = false }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      style={{
        width,
        padding: `${SPACE_4}px ${SPACE_8}px`,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        color: TEXT,
        fontFamily: FONT,
        fontSize: FS_BASE,
        letterSpacing: TRACKING,
        textAlign: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    />
  )
}
