import { FONT, TRACKING, TEXT_MUTED, FS_CAPTION, SPACE_4, SPACE_8, SEGMENT_COLORS } from '../data/theme.js'

/**
 * A proportional multi-colour breakdown of a collection's states, plus a
 * swatch legend. Distinct from TopProgressBar, which shows one value's
 * completion — this shows how a whole is divided.
 *
 * `segments`: [{ key, label, count, description? }] — rendered in array
 * order, zero-count segments dropped. Colours come from SEGMENT_COLORS by
 * key, so callers pass data, not styling.
 */
export default function DistributionBar({ segments, showLegend = true }) {
  const visible = segments.filter(s => s.count > 0)
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return null

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
        {visible.map(s => (
          <div
            key={s.key}
            title={`${s.label}: ${s.count} (${((s.count / total) * 100).toFixed(1)}%)${s.description ? ` — ${s.description}` : ''}`}
            style={{ flex: `${s.count} 0 0`, background: SEGMENT_COLORS[s.key] ?? SEGMENT_COLORS.new }}
          />
        ))}
      </div>

      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${SPACE_4}px 14px`, marginTop: SPACE_8 }}>
          {segments.map(s => (
            <span
              key={s.key}
              title={s.description}
              style={{
                fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING,
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: s.description ? 'help' : 'default',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                background: SEGMENT_COLORS[s.key] ?? SEGMENT_COLORS.new,
              }} />
              {s.label} {s.count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
