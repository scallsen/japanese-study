import { useState, useEffect, useRef } from 'react'
import { searchMedia, selectMedia, browseMedia } from './api.js'
import { fetchRecommendedMedia } from './recommendedMediaCache.js'
import { difficultyLabel } from './difficultyLabels.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
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
const DEFAULT_MEDIA_TYPES = [1] // Anime only, by default
const ALL_DIFFICULTY_LEVELS = [0, 1, 2, 3, 4, 5] // matches the coarse `difficulty` bucket's real range

function checkboxRow(label, checked, onChange) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 14, height: 14, accentColor: ACCENT }} />
      {label}
    </label>
  )
}

function ViewModeButton({ label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
        fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
        background: active ? `${ACCENT}22` : hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? ACCENT : TEXT_MUTED,
        border: `1px solid ${active ? `${ACCENT}55` : 'rgba(255,255,255,0.12)'}`,
      }}
    >
      {label}
    </button>
  )
}

function DifficultyChip({ label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 11px', borderRadius: 999, cursor: 'pointer',
        fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
        background: active ? `${ACCENT}22` : hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? ACCENT : TEXT_MUTED,
        border: `1px solid ${active ? `${ACCENT}55` : 'rgba(255,255,255,0.12)'}`,
      }}
    >
      {label}
    </button>
  )
}

function DifficultyBadge({ difficulty }) {
  if (difficulty == null) return null
  return (
    <span style={{
      fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
      background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
    }}>
      {difficultyLabel(difficulty)} ({Number(difficulty).toFixed(1)})
    </span>
  )
}

function ResultTile({ result, onClick, busy }) {
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
        <div style={{ alignSelf: 'flex-start' }}>
          <DifficultyBadge difficulty={result.difficulty?.difficulty} />
        </div>
      </div>
    </div>
  )
}

function ResultListRow({ result, onClick, busy }) {
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
          <DifficultyBadge difficulty={result.difficulty?.difficulty} />
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
// Three fetch modes, chosen implicitly by current state (no explicit toggle):
//   - query non-empty -> text search (searchMedia), client-side filtered by
//     media type afterward (search-suggestions doesn't have a difficulty field
//     at all, so a difficulty range can't apply here — shown as a note instead
//     of silently ignored).
//   - query empty + at least one filter narrowed -> browse/listing (browseMedia).
//   - query empty + no filter narrowed -> idle/empty state, filled with the
//     cached "recommended" listing (see recommendedMediaCache.js) rather than
//     showing nothing.
export default function MediaSearch({ onSelected, onLoadingChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)
  const [mediaTypes, setMediaTypes] = useState(() => new Set(DEFAULT_MEDIA_TYPES))
  const [difficulties, setDifficulties] = useState(() => new Set(ALL_DIFFICULTY_LEVELS))
  const [viewMode, setViewMode] = useState(() => safeLocalStorageGet('anime-vocab-view-mode') ?? 'tiles')
  const debounceRef = useRef(null)

  useEffect(() => { safeLocalStorageSet('anime-vocab-view-mode', viewMode) }, [viewMode])

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

  // Clicking a level while "All" is active starts a fresh single-level
  // selection (rather than toggling it out of the full set, which would
  // leave a confusing 5-of-6 state). From there, clicks add/remove
  // individual levels — a discontiguous set is fine, it's still a valid
  // filter. Emptying the set entirely snaps back to "All" instead of
  // leaving a selection that would match nothing.
  function toggleDifficulty(level) {
    setDifficulties(prev => {
      if (prev.size === ALL_DIFFICULTY_LEVELS.length) return new Set([level])
      const next = new Set(prev)
      if (next.has(level)) next.delete(level); else next.add(level)
      return next.size === 0 ? new Set(ALL_DIFFICULTY_LEVELS) : next
    })
  }

  function selectAllDifficulties() {
    setDifficulties(new Set(ALL_DIFFICULTY_LEVELS))
  }

  const isDefaultMediaTypes = mediaTypes.size === DEFAULT_MEDIA_TYPES.length && DEFAULT_MEDIA_TYPES.every(t => mediaTypes.has(t))
  const isAllDifficulties = difficulties.size === ALL_DIFFICULTY_LEVELS.length
  const filterNarrowed = !isDefaultMediaTypes || !isAllDifficulties
  const selectedLabels = new Set([...mediaTypes].map(t => MEDIA_TYPE_LABELS[t]))
  const isIdle = !query.trim() && !filterNarrowed

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

    // Jiten's difficultyMin/Max filters the continuous difficultyRaw score,
    // not the rounded bucket a chip represents — bucket N covers raw scores
    // [N, N+1), so querying min=max=N (e.g. "Beginner" -> 0-0) matches
    // essentially nothing (confirmed live: 0 results) where 0-0.99 correctly
    // returns real matches. Widen the upper bound by 1 bucket-width so the
    // superset query actually captures the bucket's real range; chip
    // selection can also be a discontiguous set (e.g. levels 1 and 4 with
    // 2-3 excluded), so the exact set is still enforced client-side after.
    const matchesDifficulty = x => isAllDifficulties
      || (x.difficulty?.difficulty != null && difficulties.has(x.difficulty.difficulty))

    if (filterNarrowed) {
      setLoading(true)
      browseMedia({
        mediaTypes: [...mediaTypes],
        difficultyMin: isAllDifficulties ? null : Math.min(...difficulties),
        difficultyMax: isAllDifficulties ? null : Math.max(...difficulties) + 1,
        sortBy: 'difficulty', sortDirection: 'asc', limit: 24,
      })
        .then(({ results: r }) => { setResults(r.filter(x => selectedLabels.has(x.mediaType) && matchesDifficulty(x))); setError(null) })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
      return
    }

    setLoading(true)
    fetchRecommendedMedia()
      .then(r => { setResults(r.filter(x => selectedLabels.has(x.mediaType) && matchesDifficulty(x))); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, [...mediaTypes].join(','), [...difficulties].sort().join(',')])

  async function handleSelect(result) {
    setSelectingId(result.externalId)
    setError(null)
    try {
      const {
        mediaId, title, mediaType, coverUrl, difficulty, originalTitle, description, tags, links, relationships, episodes,
      } = await selectMedia(result.externalId)
      onSelected({
        id: mediaId, title, mediaType, coverUrl, difficulty, externalId: result.externalId,
        originalTitle, description, tags, links, relationships,
      }, episodes)
    } catch (err) {
      setError(err.message)
      setSelectingId(null)
    }
  }

  const ResultItem = viewMode === 'tiles' ? ResultTile : ResultListRow

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
          <DifficultyChip label="All" active={isAllDifficulties} onClick={selectAllDifficulties} />
          {ALL_DIFFICULTY_LEVELS.map(level => (
            <DifficultyChip key={level} label={difficultyLabel(level)} active={difficulties.has(level)} onClick={() => toggleDifficulty(level)} />
          ))}
          {query.trim() && !isAllDifficulties && (
            <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              Difficulty filtering is not available for text search — clear the search box to browse by difficulty.
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {isIdle ? 'Recommended — beginner friendly' : ''}
        </span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <ViewModeButton label="List" active={viewMode === 'list'} onClick={() => setViewMode('list')} />
          <ViewModeButton label="Tiles" active={viewMode === 'tiles'} onClick={() => setViewMode('tiles')} />
        </div>
      </div>

      {showSearching && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {isIdle ? 'Loading recommended series...' : 'Searching...'}
        </div>
      )}
      <div style={viewMode === 'tiles'
        ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }
        : { display: 'flex', flexDirection: 'column', gap: 10 }
      }>
        {results.map(r => (
          <ResultItem key={r.externalId} result={r} busy={selectingId === r.externalId} onClick={() => handleSelect(r)} />
        ))}
      </div>
      {!loading && !isIdle && results.length === 0 && !error && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>No results.</div>
      )}
    </div>
  )
}
