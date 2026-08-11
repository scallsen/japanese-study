import { useState, useEffect, useRef } from 'react'
import { searchMedia, selectMedia } from './api.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'
const DEBOUNCE_MS = 400

function ResultRow({ result, onClick, busy }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={busy ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#313131' : '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '14px 18px',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.5 : 1,
        transition: 'background 130ms',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {result.coverUrl && (
        <img src={result.coverUrl} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
            background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px',
          }}>
            {result.mediaType}
          </span>
          {result.mediaId && (
            <span style={{ fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: '#6BCB6B' }}>
              Already added
            </span>
          )}
        </div>
        <div style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.title}
        </div>
        {result.originalTitle && result.originalTitle !== result.title && (
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.originalTitle}
          </div>
        )}
      </div>
    </div>
  )
}

// Search + select screen. On selecting a result, links it into media/media_provider_ref/
// media_episode (via the anime-media-select edge function) and calls onSelected(media, episodes).
export default function MediaSearch({ onSelected }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      searchMedia(query.trim())
        .then(({ results: r }) => { setResults(r); setError(null) })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function handleSelect(result) {
    setSelectingId(result.externalId)
    setError(null)
    try {
      const { mediaId, title, mediaType, episodes } = await selectMedia(result.externalId)
      onSelected({ id: mediaId, title, mediaType }, episodes)
    } catch (err) {
      setError(err.message)
      setSelectingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search for an anime..."
        autoFocus
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: FS_LIST_TITLE,
          fontFamily: FONT,
          letterSpacing: 'normal',
          background: '#2A2A2A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: TEXT,
          outline: 'none',
        }}
      />
      {error && (
        <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
      )}
      {loading && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>Searching...</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map(r => (
          <ResultRow key={r.externalId} result={r} busy={selectingId === r.externalId} onClick={() => handleSelect(r)} />
        ))}
      </div>
      {!loading && query.trim() && results.length === 0 && !error && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>No results.</div>
      )}
    </div>
  )
}
