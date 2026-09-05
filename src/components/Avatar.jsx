import { FONT, TRACKING } from '../data/theme.js'

// Fixed, not the ambient module accent. The avatar sits in the header on every
// route, so reading the accent recoloured it on each navigation — teal on the
// dashboard, pink in anime vocab, red in the news reader — which reads as a
// different control rather than as one identity. What it stands for is the
// user, and that doesn't change with the page.
const AVATAR_COLOR = '#3A7FEF'

// Up to two initials from a display name, falling back to the first letter of
// an email's local part. A single "?" rather than an empty circle when there's
// nothing usable, so the control still reads as a target.
function initialsFrom(name) {
  const source = (name ?? '').trim()
  if (!source) return '?'
  const words = source.includes('@') ? [source.split('@')[0]] : source.split(/\s+/)
  const letters = words.slice(0, 2).map(w => w[0]).filter(Boolean).join('')
  return letters ? letters.toUpperCase() : '?'
}

/**
 * A circular initials badge. Presentational only — a caller that needs it to
 * be clickable wraps it in its own button, which is also what keeps the
 * anchor ref for a popover on the caller's element rather than in here.
 *
 * Tinted with the same recipe as `Button`'s accent-outline variant, but
 * against a fixed colour (see AVATAR_COLOR) rather than the ambient module
 * accent. `accent` stays as an explicit per-instance override.
 */
export default function Avatar({ name, size = 34, accent }) {
  const resolved = accent ?? AVATAR_COLOR
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `${resolved}29`,
        border: `1px solid ${resolved}6b`,
        color: resolved,
        fontFamily: FONT,
        // Derived from the diameter rather than a fixed token, so the circle
        // stays proportional at any size a caller asks for.
        fontSize: Math.round(size * 0.38),
        letterSpacing: TRACKING,
        // The tracking above adds a trailing gap that reads as off-centre on a
        // circle, so pull it back by half.
        textIndent: '0.025em',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {initialsFrom(name)}
    </span>
  )
}
