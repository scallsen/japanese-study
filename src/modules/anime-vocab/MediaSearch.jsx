import { useState, useEffect, useRef } from 'react'
import { selectMedia, browseMedia } from './api.js'
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

// Soft content-maturity tiers — the hard-block (server-side, non-optional)
// floor is enforced regardless of this setting; see jitenClient.js's
// browseMedia for the full reasoning behind these three buckets. Multi-select
// (like difficulty): a title is classified into exactly one bucket server-side
// (neither signal -> safe, one signal -> slightly-suggestive, both -> suggestive)
// and shown if its bucket is in the selected set.
const MATURITY_LEVELS = ['safe', 'slightly-suggestive', 'suggestive']
const MATURITY_LABELS = { safe: 'Safe', 'slightly-suggestive': 'Slightly suggestive', suggestive: 'Suggestive' }
const DEFAULT_MATURITY = ['safe']

// Only fields confirmed live to sort correctly server-side (see
// anime-media-browse's header comment) — externalRating/creationDate/
// distinctVoterCount were tried and aren't reliably ordered, so they're not
// offered here. Each combines a sortBy key with a direction; "descending"
// is simulated server-side by walking from the end backward (still true
// global order, not just a locally-reversed page — see anime-media-browse).
const SORT_OPTIONS = [
  { value: 'difficulty-asc', label: 'Difficulty: Easiest first' },
  { value: 'difficulty-desc', label: 'Difficulty: Hardest first' },
  { value: 'releaseDate-desc', label: 'Release date: Newest first' },
  { value: 'releaseDate-asc', label: 'Release date: Oldest first' },
  { value: 'title-asc', label: 'Title: A–Z' },
  { value: 'title-desc', label: 'Title: Z–A' },
  { value: 'wordCount-asc', label: 'Word count: Shortest first' },
  { value: 'wordCount-desc', label: 'Word count: Longest first' },
]
const DEFAULT_SORT = 'difficulty-asc'
const RESULTS_PAGE_SIZE = 24

function ViewModeButton({ label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
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

function SortSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '5px 26px 5px 10px',
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        borderRadius: 4,
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.06)',
        color: TEXT_MUTED,
        border: '1px solid rgba(255,255,255,0.12)',
        outline: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {SORT_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// Shared toggle chip — used for both the media-type and difficulty filter
// rows (same click-to-select/click-to-deselect interaction either way).
function Chip({ label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 11px', borderRadius: 4, cursor: 'pointer',
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

// Fixed width (not just flexShrink: 0) so every section's chips start at the
// same x position regardless of label length, and a top margin to match a
// chip's own vertical padding — needed once alignItems switches to
// flex-start so the label sits level with the first line of chips instead
// of vertically centering against however many lines they wrap onto.
function FilterSectionLabel({ children }) {
  return (
    <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0, width: 92, marginTop: 4 }}>
      {children}
    </span>
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
// Two fetch modes, chosen implicitly by current state (no explicit toggle):
//   - idle (query empty + no filter narrowed) -> the cached "recommended"
//     listing (see recommendedMediaCache.js) rather than showing nothing.
//   - otherwise -> browseMedia, for BOTH text search and filter-only
//     browsing. A query is passed straight through as a title filter
//     (Jiten's own titleFilter param, confirmed to match romaji or Japanese
//     title text server-side) rather than hitting a separate search
//     endpoint, so difficulty/maturity filtering and "Load more" pagination
//     both work identically whether or not there's a query — search no
//     longer bypasses filters or caps out at a fixed handful of results.
export default function MediaSearch({ onSelected, onLoadingChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [error, setError] = useState(null)
  const [selectingId, setSelectingId] = useState(null)
  const [mediaTypes, setMediaTypes] = useState(() => new Set(DEFAULT_MEDIA_TYPES))
  const [difficulties, setDifficulties] = useState(() => new Set(ALL_DIFFICULTY_LEVELS))
  const [maturity, setMaturity] = useState(() => new Set(DEFAULT_MATURITY))
  const [sortValue, setSortValue] = useState(() => safeLocalStorageGet('anime-vocab-sort') ?? DEFAULT_SORT)
  const [viewMode, setViewMode] = useState(() => safeLocalStorageGet('anime-vocab-view-mode') ?? 'tiles')
  const debounceRef = useRef(null)
  const fetchTokenRef = useRef(0)

  useEffect(() => { safeLocalStorageSet('anime-vocab-view-mode', viewMode) }, [viewMode])
  useEffect(() => { safeLocalStorageSet('anime-vocab-sort', sortValue) }, [sortValue])

  const busy = loading || selectingId !== null
  useEffect(() => {
    onLoadingChange?.(busy)
    // Reset on unmount/prop-loss too, as a safety net — the real reset for
    // a successful select is `setSelectingId(null)` in handleSelect itself,
    // since this component stays mounted (just hidden) after selecting, so
    // there's no unmount to rely on to clear `busy`.
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

  // Plain multi-select toggle, same shape as toggleType — but snaps back to
  // the default ("safe" only) rather than allowing zero levels selected,
  // since an empty maturity set would silently show nothing.
  function toggleMaturity(level) {
    setMaturity(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level); else next.add(level)
      return next.size === 0 ? new Set(DEFAULT_MATURITY) : next
    })
  }

  const isDefaultMediaTypes = mediaTypes.size === DEFAULT_MEDIA_TYPES.length && DEFAULT_MEDIA_TYPES.every(t => mediaTypes.has(t))
  const isAllDifficulties = difficulties.size === ALL_DIFFICULTY_LEVELS.length
  const isDefaultMaturity = maturity.size === DEFAULT_MATURITY.length && DEFAULT_MATURITY.every(l => maturity.has(l))
  const filterNarrowed = !isDefaultMediaTypes || !isAllDifficulties || !isDefaultMaturity
  const selectedLabels = new Set([...mediaTypes].map(t => MEDIA_TYPE_LABELS[t]))
  const isIdle = !query.trim() && !filterNarrowed
  const [sortBy, sortDirection] = sortValue.split('-')

  // Jiten's difficultyMin/Max filters the continuous difficultyRaw score,
  // not the rounded bucket a chip represents — bucket N covers raw scores
  // [N, N+1), so querying min=max=N (e.g. "Beginner" -> 0-0) matches
  // essentially nothing (confirmed live: 0 results) where 0-0.99 correctly
  // returns real matches. Widen the upper bound by 1 bucket-width so the
  // superset query actually captures the bucket's real range; chip
  // selection can also be a discontiguous set (e.g. levels 1 and 4 with
  // 2-3 excluded), so the exact set is still enforced client-side below —
  // the server only ever gets the continuous range as a hint.
  const difficultyMin = isAllDifficulties ? null : Math.min(...difficulties)
  const difficultyMax = isAllDifficulties ? null : Math.max(...difficulties) + 1
  function matchesDifficulty(x) {
    return isAllDifficulties || (x.difficulty?.difficulty != null && difficulties.has(x.difficulty.difficulty))
  }
  function passesClientFilters(x) {
    return selectedLabels.has(x.mediaType) && matchesDifficulty(x)
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    const requestId = ++fetchTokenRef.current

    function commit(r, nextCursor) {
      if (fetchTokenRef.current !== requestId) return
      setResults(r.filter(passesClientFilters))
      setCursor(nextCursor)
      setError(null)
    }
    function fail(err) {
      if (fetchTokenRef.current === requestId) setError(err.message)
    }
    function done() {
      if (fetchTokenRef.current === requestId) setLoading(false)
    }

    if (isIdle) {
      // The curated recommended list (recommendedMediaCache.js) is a small,
      // hand-picked set of wholesome beginner titles — safe by construction,
      // so it's never run back through the maturity filter, and there's
      // nothing to paginate.
      setLoading(true)
      setCursor(null)
      fetchRecommendedMedia().then(r => commit(r, null)).catch(fail).finally(done)
      return
    }

    function runFetch() {
      setLoading(true)
      setCursor(null)
      browseMedia({
        query: q || undefined,
        mediaTypes: [...mediaTypes],
        difficultyMin, difficultyMax,
        maturityLevels: [...maturity],
        sortBy, sortDirection,
        limit: RESULTS_PAGE_SIZE,
      })
        .then(({ results: r, nextCursor }) => commit(r, nextCursor))
        .catch(fail)
        .finally(done)
    }

    if (q) {
      setLoading(true)
      debounceRef.current = setTimeout(runFetch, DEBOUNCE_MS)
      return () => clearTimeout(debounceRef.current)
    }
    runFetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, [...mediaTypes].join(','), [...difficulties].sort().join(','), [...maturity].sort().join(','), sortValue])

  function handleLoadMore() {
    if (!cursor || loading || loadingMore) return
    const requestId = ++fetchTokenRef.current
    setLoadingMore(true)
    browseMedia({
      query: query.trim() || undefined,
      mediaTypes: [...mediaTypes],
      difficultyMin, difficultyMax,
      maturityLevels: [...maturity],
      sortBy, sortDirection,
      limit: RESULTS_PAGE_SIZE,
      cursor,
    })
      .then(({ results: r, nextCursor }) => {
        if (fetchTokenRef.current !== requestId) return
        const filtered = r.filter(passesClientFilters)
        setResults(prev => {
          const seen = new Set(prev.map(p => p.externalId))
          return [...prev, ...filtered.filter(x => !seen.has(x.externalId))]
        })
        setCursor(nextCursor)
        setError(null)
      })
      .catch(err => { if (fetchTokenRef.current === requestId) setError(err.message) })
      .finally(() => { if (fetchTokenRef.current === requestId) setLoadingMore(false) })
  }

  async function handleSelect(result) {
    setSelectingId(result.externalId)
    setError(null)
    try {
      const {
        mediaId, title, mediaType, coverUrl, difficulty, originalTitle, description, tags, links, relationships, episodes,
      } = await selectMedia(result.externalId, [...maturity])
      setSelectingId(null)
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

      <div style={{ display: 'flex', flexDirection: 'column', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
          <FilterSectionLabel>Content</FilterSectionLabel>
          {/* flex: 1 + minWidth: 0 lets this wrap its OWN chips onto multiple
              lines within the remaining width, instead of the outer row (which
              sees its unwrapped max-content width) dropping the whole thing —
              label included — onto a line of its own. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
            {ALL_MEDIA_TYPES.map(t => (
              <Chip key={t} label={MEDIA_TYPE_LABELS[t]} active={mediaTypes.has(t)} onClick={() => toggleType(t)} />
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FilterSectionLabel>Difficulty</FilterSectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
              <Chip label="All" active={isAllDifficulties} onClick={selectAllDifficulties} />
              {ALL_DIFFICULTY_LEVELS.map(level => (
                <Chip key={level} label={difficultyLabel(level)} active={difficulties.has(level)} onClick={() => toggleDifficulty(level)} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FilterSectionLabel>Maturity</FilterSectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
              {MATURITY_LEVELS.map(level => (
                <Chip key={level} label={MATURITY_LABELS[level]} active={maturity.has(level)} onClick={() => toggleMaturity(level)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {isIdle ? 'Recommended — beginner friendly' : ''}
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          {!isIdle && <SortSelect value={sortValue} onChange={setSortValue} />}
          <div style={{ display: 'flex', gap: 6 }}>
            <ViewModeButton label="List" active={viewMode === 'list'} onClick={() => setViewMode('list')} />
            <ViewModeButton label="Tiles" active={viewMode === 'tiles'} onClick={() => setViewMode('tiles')} />
          </div>
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
      {!isIdle && !loading && cursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            alignSelf: 'center',
            padding: '8px 20px',
            fontSize: FS_BASE,
            fontFamily: FONT,
            letterSpacing: TRACKING,
            borderRadius: 6,
            cursor: loadingMore ? 'default' : 'pointer',
            background: 'rgba(255,255,255,0.06)',
            color: loadingMore ? 'rgba(255,255,255,0.3)' : TEXT_MUTED,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {loadingMore ? 'Loading more...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
