import { FS_BASE, SPACE_4, SPACE_12, SPACE_16, TEXT, TEXT_MUTED, WARNING, DANGER, SUCCESS } from '../data/theme.js'

// A tinted strip stating a condition of the page itself — a feature being
// unavailable, a limit reached — as opposed to Toast, which reports the outcome
// of something the user just did and then leaves. The deciding test is whether
// the message is still true a minute later with no input: if it is, it belongs
// here, because a toast would have vanished while the condition remained.
//
// Colours reuse the semantic tokens at low alpha rather than introducing a
// fourth palette, matching the tint/border/text treatment Badge already uses.
const TONES = {
  warning: WARNING,
  danger: DANGER,
  success: SUCCESS,
  neutral: TEXT_MUTED,
}

export default function Notice({ tone = 'warning', title, children, style }) {
  const color = TONES[tone] ?? TONES.warning
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE_4,
        padding: `${SPACE_12}px ${SPACE_16}px`,
        borderRadius: 8,
        // Tint rather than a solid fill: the strip sits inside page content, and
        // a solid warning colour would out-shout the controls it describes.
        background: `${color}1A`,
        border: `1px solid ${color}40`,
        fontSize: FS_BASE,
        color: TEXT,
        ...style,
      }}
    >
      {title ? <div style={{ color }}>{title}</div> : null}
      {children ? <div style={{ color: TEXT_MUTED }}>{children}</div> : null}
    </div>
  )
}
