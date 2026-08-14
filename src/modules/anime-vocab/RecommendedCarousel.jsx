import { useState, useEffect } from 'react'
import { browseMedia, selectMedia } from './api.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, SUBHEADING_STYLE, FS_BADGE, FS_BASE } from '../../data/theme.js'

const ACCENT = '#D46EA3'

function RecommendedCard({ result, onClick, busy }) {
  const [hovered, setHovered] = useState(false)
  const difficulty = result.difficulty?.difficulty
  return (
    <div
      onClick={busy ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#313131' : '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.5 : 1,
        transition: 'background 130ms',
      }}
    >
      {result.coverUrl ? (
        <img src={result.coverUrl} alt="" style={{ width: '100%', aspectRatio: '5 / 7', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '5 / 7', background: '#1E1E1E' }} />
      )}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.title}
        </div>
        {difficulty != null && (
          <span style={{
            fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
            background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', alignSelf: 'flex-start',
          }}>
            Difficulty {Number(difficulty).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

// "Recommended" grid shown on the Anime Vocab home screen when there's
// nothing tracked yet (signed in with an empty list, or signed out) — a
// first-draft component meant to be tweaked, not a finished feature (grid
// today, could become a real scroll-snap carousel later with no change to
// the fetch/click logic below). Sorts by difficulty ascending — the one
// sortBy/sortDirection combination confirmed to work reliably against
// Jiten's browse endpoint, see providers/jitenClient.js's browseMedia.
export default function RecommendedCarousel({ onSelected, onLoadingChange }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)

  useEffect(() => {
    onLoadingChange?.(loading)
    return () => onLoadingChange?.(false)
  }, [loading, onLoadingChange])
  const showLoadingMessage = useDelayedLoading(loading)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    browseMedia({ sortBy: 'difficulty', sortDirection: 'asc', limit: 12 })
      .then(({ results: r }) => { if (!cancelled) { setResults(r); setError(null) } })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSelect(result) {
    setSelectingId(result.externalId)
    try {
      const { mediaId, title, mediaType, coverUrl, difficulty, episodes } = await selectMedia(result.externalId)
      onSelected({ id: mediaId, title, mediaType, coverUrl, difficulty }, episodes)
    } catch (err) {
      setError(err.message)
      setSelectingId(null)
    }
  }

  if (loading) {
    return showLoadingMessage ? <CenteredLoadingMessage text="Loading recommended series" /> : null
  }
  if (error) {
    return <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
  }
  if (results.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, fontFamily: FONT, marginBottom: 10 }}>
        Recommended — beginner friendly
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {results.map(r => (
          <RecommendedCard key={r.externalId} result={r} busy={selectingId === r.externalId} onClick={() => handleSelect(r)} />
        ))}
      </div>
    </div>
  )
}
