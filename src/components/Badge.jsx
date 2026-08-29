import { FONT, TRACKING, FS_BADGE, TEXT_MUTED } from '../data/theme.js'

const TONE_COLORS = {
  accent: '#3ABDA4',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  neutral: TEXT_MUTED,
}

// Small classification pill — JLPT level, part-of-speech, difficulty, SRS
// status, "common", etc. `variant="fill"` is the tinted-pill treatment used
// for most badges; `variant="text"` is bare colored text with no background,
// used where a badge would compete with too much other chrome (e.g. dense
// table cells, DictionaryPage's "common" marker).
export default function Badge({ tone = 'neutral', variant = 'fill', children }) {
  const color = TONE_COLORS[tone] ?? TONE_COLORS.neutral

  // width: fit-content matters — as a child of a flex *column* the default
  // align-items: stretch would otherwise blow the pill out to the container's
  // full width. A badge must always be exactly as wide as its label.
  if (variant === 'text') {
    return (
      <span style={{ fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BADGE, color, flexShrink: 0, width: 'fit-content' }}>
        {children}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        fontSize: FS_BADGE,
        color,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '1px 7px',
        flexShrink: 0,
        width: 'fit-content',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
