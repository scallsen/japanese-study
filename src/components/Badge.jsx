import { FONT, TRACKING, FS_BADGE, TEXT_MUTED, SUCCESS, WARNING, DANGER } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

// Small classification pill — JLPT level, part-of-speech, difficulty, SRS
// status, "common", etc. `variant="fill"` is the tinted-pill treatment used
// for most badges; `variant="text"` is bare colored text with no background,
// used where a badge would compete with too much other chrome (e.g. dense
// table cells, DictionaryPage's "common" marker).
//
// `accent` prop mirrors Chip's own accent override — only tone="accent"
// is ambient (ModuleThemeProvider); success/warning/danger/neutral stay
// fixed semantic colors regardless of module (a "danger" badge shouldn't
// turn pink in a pink module). Anime Vocab's difficulty/mediaType badges
// are the first real accent="accent" consumers.
//
// `dimmed` renders the whole pill/text at reduced opacity — generic, not
// JLPT-specific, so it's reusable for any "approximate value" case (the
// `~`-prefixed inferred JLPT level is the first; Dictionary's own inferred
// levels are a likely second). The `~` prefix and any tooltip stay
// call-site content, not a Badge concern.
export default function Badge({ tone = 'neutral', variant = 'fill', accent, dimmed = false, children }) {
  const moduleAccent = useAccent(accent)
  const TONE_COLORS = {
    accent: moduleAccent,
    success: SUCCESS,
    warning: WARNING,
    danger: DANGER,
    neutral: TEXT_MUTED,
  }
  const color = TONE_COLORS[tone] ?? TONE_COLORS.neutral
  const opacity = dimmed ? 0.55 : 1

  // width: fit-content matters — as a child of a flex *column* the default
  // align-items: stretch would otherwise blow the pill out to the container's
  // full width. A badge must always be exactly as wide as its label.
  if (variant === 'text') {
    return (
      <span style={{ fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BADGE, color, opacity, flexShrink: 0, width: 'fit-content' }}>
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
        opacity,
      }}
    >
      {children}
    </span>
  )
}
