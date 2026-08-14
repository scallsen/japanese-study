import { useState, useEffect, useRef } from 'react'
import { searchMedia, selectMedia, browseMedia } from './api.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'
const DEBOUNCE_MS = 400

// Duplicated from providers/jitenClient.js — that file is server-only (see
// its own header comment), never imported into browser code.
const MEDIA_TYPE_LABELS = {
  1: 'Anime', 2: 'Drama', 3: 'Movie', 4: 'Novel', 5: 'Non-fiction',
  6: 'Video game', 7: 'Visual novel', 8: 'Web novel', 9: 'Manga', 10: 'Audio',
}
const ALL_MEDIA_TYPES = Object.keys(MEDIA_TYPE_LABELS).map(Number)

function checkboxRow(label, checked, onChange) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 14, height: 14, accentColor: ACCENT }} />
      {label}
    </label>
  )
}

function ResultRow({ result, onClick, busy }) {
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
          {difficulty != null && (
            <span style={{
              fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
              background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px',
            }}>
              Difficulty {Number(difficulty).toFixed(1)}
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
//
// Two fetch modes, chosen implicitly by current state (no explicit toggle):
//   - query non-empty -> text search (searchMedia), client-side filtered by
//     media type afterward (search-suggestions doesn't have a difficulty field
//     at all, so a difficulty range can't apply here — shown as a note instead
//     of silently ignored).
//   - query empty + at least one filter narrowed -> browse/listing (browseMedia).
//   - query empty + no filter narrowed -> nothing shown (existing behavior;
//     the "nothing tracked yet" empty state is a separate component).
export default function MediaSearch({ onSelected, onLoadingChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)
  const [mediaTypes, setMediaTypes] = useState(() => new Set(ALL_MEDIA_TYPES))
  const [difficultyMin, setDifficultyMin] = useState('')
  const [difficultyMax, setDifficultyMax] = useState('')
  const debounceRef = useRef(null)

  const busy = loading || selectingId !== null
  useEffect(() => {
    onLoadingChange?.(busy)
    // Reset on unmount too — e.g. selecting a result unmounts this screen
    // before `busy` ever gets a chance to go back to false on its own.
    return () => onLoadingChange?.(false)
  }, [busy, onLoadingChange])
  const showSearching = useDelayedLoading(loading)

  function toggleType(t) {
    setMediaTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  const filterNarrowed = mediaTypes.size < ALL_MEDIA_TYPES.length || difficultyMin !== '' || difficultyMax !== ''
  const selectedLabels = new Set([...mediaTypes].map(t => MEDIA_TYPE_LABELS[t]))
  const hasDifficultyRange = difficultyMin !== '' || difficultyMax !== ''

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()

    if (q) {
      setLoading(true)
      debounceRef.current = setTimeout(() => {
        searchMedia(q)
          .then(({ results: r }) => { setResults(r.filter(x => selectedLabels.has(x.mediaType))); setError(null) })
          .catch(err => setError(err.message))
          .finally(() => setLoading(false))
      }, DEBOUNCE_MS)
      return () => clearTimeout(debounceRef.current)
    }

    if (!filterNarrowed) { setResults([]); setLoading(false); return }

    setLoading(true)
    browseMedia({
      mediaTypes: [...mediaTypes],
      difficultyMin: difficultyMin === '' ? null : Number(difficultyMin),
      difficultyMax: difficultyMax === '' ? null : Number(difficultyMax),
      sortBy: 'difficulty', sortDirection: 'asc', limit: 24,
    })
      .then(({ results: r }) => { setResults(r.filter(x => selectedLabels.has(x.mediaType))); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, [...mediaTypes].join(','), difficultyMin, difficultyMax])

  async function handleSelect(result) {
    setSelectingId(result.externalId)
    setError(null)
    try {
      const { mediaId, title, mediaType, coverUrl, difficulty, episodes } = await selectMedia(result.externalId)
      onSelected({ id: mediaId, title, mediaType, coverUrl, difficulty }, episodes)
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {ALL_MEDIA_TYPES.map(t => checkboxRow(MEDIA_TYPE_LABELS[t], mediaTypes.has(t), () => toggleType(t)))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>Difficulty</span>
          <input
            type="number" step="0.5" placeholder="Min" value={difficultyMin}
            onChange={e => setDifficultyMin(e.target.value)}
            style={{ width: 64, padding: '4px 8px', fontFamily: FONT, background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: TEXT }}
          />
          <span style={{ color: TEXT_MUTED }}>–</span>
          <input
            type="number" step="0.5" placeholder="Max" value={difficultyMax}
            onChange={e => setDifficultyMax(e.target.value)}
            style={{ width: 64, padding: '4px 8px', fontFamily: FONT, background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: TEXT }}
          />
          {query.trim() && hasDifficultyRange && (
            <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              Difficulty filtering is not available for text search — clear the search box to browse by difficulty.
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
      )}
      {showSearching && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>Searching...</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map(r => (
          <ResultRow key={r.externalId} result={r} busy={selectingId === r.externalId} onClick={() => handleSelect(r)} />
        ))}
      </div>
      {!loading && (query.trim() || filterNarrowed) && results.length === 0 && !error && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>No results.</div>
      )}
    </div>
  )
}
