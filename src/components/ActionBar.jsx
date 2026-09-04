import { SPACE_12, SPACE_24 } from '../data/theme.js'

const BG = '#1E1E1E'
const HAIRLINE = 'rgba(255,255,255,0.08)'

// Height the bar occupies (padding + a md/lg Button) — consumers add this
// as bottom padding on their scroll container so content isn't hidden.
export const ACTION_BAR_HEIGHT = 72

// The sticky bottom bar for a screen's primary actions — Anime Vocab's
// "Start Drill", Vocab Drill's Start review / Preview, Story's Generate.
// Extracted from EpisodeVocabBrowser's fixed footer. `leading` is an
// optional left-side slot (a status line like "935 words in context");
// children are the buttons, right-aligned, wrapping on narrow screens.
export default function ActionBar({ leading, maxWidth = 640, children }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
      background: BG, borderTop: `1px solid ${HAIRLINE}`,
      padding: `${SPACE_12}px ${SPACE_24}px`,
      paddingBottom: `calc(${SPACE_12}px + env(safe-area-inset-bottom))`,
    }}>
      <div style={{ maxWidth, margin: '0 auto', display: 'flex', alignItems: 'center', gap: SPACE_12, flexWrap: 'wrap' }}>
        {leading && <div style={{ flex: 1, minWidth: 0 }}>{leading}</div>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: SPACE_12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
