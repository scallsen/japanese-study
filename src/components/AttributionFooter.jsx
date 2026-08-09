import { ATTRIBUTIONS } from '../data/attributions.js'
import { FONT, TRACKING, TEXT_MUTED, FS_SM } from '../data/theme.js'
import { renderAttributionSegments } from '../utils/attributionSegments.jsx'

// Renders the credits for `sources` (attribution ids from src/data/attributions.js)
// as a normal in-flow block at the end of a page's scrollable content — a
// classic flexbox "sticky footer": the page's content wrapper uses flex:1 so
// short content pushes this down to the bottom of the viewport, while tall
// (scrolling) content just has it trail after normally, never overlapping
// content underneath. Add new sources in attributions.js and reference their
// id here — no per-page copy-pasting of credit text. Pass only the ids a
// given page/screen actually uses (e.g. a page with no example sentences
// omits 'tanaka-corpus'); an unknown id or empty list renders nothing.
export default function AttributionFooter({ sources }) {
  const credits = (sources ?? []).map(id => ATTRIBUTIONS[id]).filter(Boolean)
  if (credits.length === 0) return null

  return (
    <div style={{
      width: '100%',
      textAlign: 'center',
      padding: '16px 16px 4px',
      fontSize: FS_SM,
      color: TEXT_MUTED,
      fontFamily: FONT,
      letterSpacing: TRACKING,
      opacity: 0.55,
      lineHeight: 1.6,
      flexShrink: 0,
    }}>
      {credits.map((segments, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {renderAttributionSegments(segments)}
        </span>
      ))}
    </div>
  )
}
