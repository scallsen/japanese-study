import { SPACE_16 } from '../data/theme.js'

const SURFACE = '#2A2A2A'
const BORDER = 'rgba(255,255,255,0.06)'

// The raised-surface shell repeated inline 8+ times across Dictionary,
// Anime Vocab, and SRS (background: SURFACE, 1px hairline border, 8px
// radius). Not what DataList/EpisodeVocabBrowser-style containers use
// internally — this is for wrapping arbitrary content blocks elsewhere.
export default function Card({ children, padding = SPACE_16, style }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding, ...style }}>
      {children}
    </div>
  )
}
