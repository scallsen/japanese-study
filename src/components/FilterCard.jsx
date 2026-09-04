import Card from './Card.jsx'
import { FONT, TRACKING, TEXT, FS_BASE, SPACE_12, SPACE_16 } from '../data/theme.js'

const HAIRLINE = 'rgba(255,255,255,0.08)'

// A Card of labelled control rows separated by hairlines — the filter block
// MediaSearch built inline (Content / Difficulty / Maturity), now also
// Story's generator form. The control is any node: a ChipSelector row, a
// Select, a Chip + ChipSelector pair. Label width (92) and row padding
// (12/16) are MediaSearch's real values.
export function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE_12, padding: `${SPACE_12}px ${SPACE_16}px` }}>
      <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0, width: 92, marginTop: 4 }}>
        {label}
      </span>
      {/* flex: 1 + minWidth: 0 lets the control wrap its own chips within the
          remaining width instead of the row dropping label and all onto a
          new line. */}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export default function FilterCard({ children }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean)
  return (
    <Card padding={0} style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, i) => (
        <div key={row?.key ?? i}>
          {i > 0 && <div style={{ height: 1, background: HAIRLINE }} />}
          {row}
        </div>
      ))}
    </Card>
  )
}
