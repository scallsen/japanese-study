import Badge from './Badge.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_LIST_TITLE, SPACE_4, SPACE_8, SPACE_16 } from '../data/theme.js'

const SURFACE = '#2A2A2A'
const READ_MARK = '#6BCB6B'

/**
 * One item in a browsable feed — badge row, title, optional subtitle, meta.
 * Reconciles Immersion's `ArticleCard` and Story's `RecentCard`, which were
 * near-duplicates that had drifted apart:
 *
 *  - padding 18/20 vs 14/16      → SPACE_16 uniform (on-scale, between the two)
 *  - hover via useState vs CSS   → CSS class only. ArticleCard's useState hover
 *                                  actually violated the project's own
 *                                  StrictMode rule; this fixes it.
 *  - transition 130ms vs 120ms   → 120ms, matching every other row/card here
 *  - title in FONT vs KANJI_FONT → FONT (the app's brand face). Both cards show
 *                                  Japanese titles, so the split was drift, not
 *                                  intent — but see the open design question
 *                                  before treating this as settled.
 *
 * `badges` is an array of { label, tone } passed straight to the Badge atom,
 * which covers both the accent-toned source badge and the neutral difficulty/
 * format badge without either card hand-rolling pill styles.
 */
export default function FeedCard({ badges = [], title, subtitle, meta, read = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className="feed-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: SPACE_4,
        background: SURFACE,
        border: `1px solid rgba(255,255,255,${read ? '0.12' : '0.07'})`,
        borderRadius: 8,
        padding: SPACE_16,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {(badges.length > 0 || meta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8 }}>
          {badges.map(b => (
            <Badge key={b.label} tone={b.tone ?? 'neutral'}>{b.label}</Badge>
          ))}
          {meta && (
            <span style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: SPACE_4,
              fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING,
            }}>
              {read && <span style={{ color: READ_MARK }}>✓</span>}
              {meta}
            </span>
          )}
        </div>
      )}

      <div style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.5 }}>
        {title}
      </div>

      {subtitle && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
