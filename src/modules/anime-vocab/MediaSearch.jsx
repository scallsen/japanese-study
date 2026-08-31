import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { selectMedia, browseMedia } from './api.js'
import { fetchRecommendedMedia } from './recommendedMediaCache.js'
import { difficultyLabel } from './difficultyLabels.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'
import Select from '../../components/Select.jsx'
import TextInput from '../../components/TextInput.jsx'
import Button from '../../components/Button.jsx'
import DataList from '../../components/DataList.jsx'
import Badge from '../../components/Badge.jsx'
import Card from '../../components/Card.jsx'
import FeedCard from '../../components/FeedCard.jsx'
import { Chip, default as ChipSelector } from '../../components/Chip.jsx'

const DEBOUNCE_MS = 400

const RESULT_COLUMNS = [
  {
    key: 'cover', width: 40,
    render: r => r.coverUrl && <img src={r.coverUrl} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4 }} />,
  },
  {
    key: 'content', flex: 1,
    render: r => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone="accent">{r.mediaType}</Badge>
          {r.difficulty?.difficulty != null && (
            <Badge tone="accent">{difficultyLabel(r.difficulty.difficulty)} ({Number(r.difficulty.difficulty).toFixed(1)})</Badge>
          )}
        </div>
        <div style={{ fontSize: FS_LIST_TITLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        {r.originalTitle && r.originalTitle !== r.title && (
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.originalTitle}</div>
        )}
      </div>
    ),
  },
]

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

// Small "i" info icon. Hovering shows the popover; clicking pins it open
// (stays open after the mouse leaves) until a click outside closes it.
// Portaled to document.body and positioned via the icon's own screen
// coordinates (position: fixed) rather than a plain position:absolute
// child, since the filter card it lives in has overflow:hidden (for its
// rounded corners) and would otherwise clip the popover.
function InfoIcon({ text }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState(null)
  const wrapRef = useRef(null)
  const popoverRef = useRef(null)

  function updateCoords() {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) setCoords({ top: rect.bottom + 6, left: rect.left })
  }

  function handleMouseEnter() {
    if (pinned) return
    updateCoords()
    setOpen(true)
  }
  function handleMouseLeave() {
    if (pinned) return
    setOpen(false)
  }
  function handleClick(e) {
    e.stopPropagation()
    updateCoords()
    setOpen(true)
    setPinned(true)
  }

  useEffect(() => {
    if (!pinned) return
    function handleOutsideClick(e) {
      if (wrapRef.current?.contains(e.target) || popoverRef.current?.contains(e.target)) return
      setOpen(false)
      setPinned(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [pinned])

  return (
    <span
      ref={wrapRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label="More info"
        style={{
          width: 14, height: 14, borderRadius: '50%', padding: 0,
          border: '1px solid rgba(255,255,255,0.35)', background: 'none',
          color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: '12px',
          fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        i
      </button>
      {open && coords && createPortal(
        <span ref={popoverRef} style={{
          position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000,
          width: 220, padding: '8px 10px', borderRadius: 6,
          background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.15)',
          color: TEXT_MUTED, fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.4,
        }}>
          {text}
        </span>,
        document.body
      )}
    </span>
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

function ResultTile({ result, onClick, busy }) {
  const badges = result.difficulty?.difficulty != null
    ? [{ label: `${difficultyLabel(result.difficulty.difficulty)} (${Number(result.difficulty.difficulty).toFixed(1)})`, tone: 'accent' }]
    : []
  return (
    <FeedCard
      image={{ src: result.coverUrl, aspectRatio: '5 / 7' }}
      title={result.title}
      badges={badges}
      onClick={onClick}
      disabled={busy}
    />
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

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TextInput
        value={query}
        onChange={setQuery}
        placeholder="Search Jiten.moe"
        size="lg"
        autoFocus
      />

      <Card padding={0} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
          <FilterSectionLabel>Content</FilterSectionLabel>
          {/* flex: 1 + minWidth: 0 lets this wrap its OWN chips onto multiple
              lines within the remaining width, instead of the outer row (which
              sees its unwrapped max-content width) dropping the whole thing —
              label included — onto a line of its own. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChipSelector
              options={ALL_MEDIA_TYPES.map(t => ({ value: t, label: MEDIA_TYPE_LABELS[t] }))}
              value={mediaTypes}
              onChange={setMediaTypes}
              mode="multi"
            />
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FilterSectionLabel>Difficulty</FilterSectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
              <Chip label="All" active={isAllDifficulties} onClick={selectAllDifficulties} />
              <ChipSelector
                options={ALL_DIFFICULTY_LEVELS.map(level => ({ value: level, label: difficultyLabel(level) }))}
                value={difficulties}
                onChange={next => {
                  // ChipSelector's multi mode always toggles the one clicked
                  // option against the CURRENT set — recover which option
                  // that was via set diff, then replay it through
                  // toggleDifficulty's own "start fresh from All" / "snap
                  // back when empty" logic, which a plain toggle-against-
                  // full-set can't express.
                  const clicked = [...next].find(v => !difficulties.has(v)) ?? [...difficulties].find(v => !next.has(v))
                  toggleDifficulty(clicked)
                }}
                mode="multi"
              />
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <FilterSectionLabel>
              Maturity
              <InfoIcon text="Content maturity rating is estimated based on tags, and is not always accurate." />
            </FilterSectionLabel>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChipSelector
                options={MATURITY_LEVELS.map(level => ({ value: level, label: MATURITY_LABELS[level] }))}
                value={maturity}
                onChange={next => setMaturity(next.size === 0 ? new Set(DEFAULT_MATURITY) : next)}
                mode="multi"
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div style={{ fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>{error}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {isIdle ? (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            Recommended — beginner friendly
          </span>
        ) : (
          <Select value={sortValue} onChange={setSortValue} options={SORT_OPTIONS} label="Sort by" />
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ChipSelector
            options={[{ value: 'list', label: 'List' }, { value: 'tiles', label: 'Tiles' }]}
            value={viewMode}
            onChange={setViewMode}
            mode="single"
          />
        </div>
      </div>

      {showSearching && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {isIdle ? 'Loading recommended series...' : 'Searching...'}
        </div>
      )}
      {viewMode === 'tiles' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {results.map(r => (
            <ResultTile key={r.externalId} result={r} busy={selectingId === r.externalId} onClick={() => handleSelect(r)} />
          ))}
        </div>
      ) : results.length > 0 && (
        <DataList
          columns={RESULT_COLUMNS}
          rows={results}
          rowKey={r => r.externalId}
          maxWidth="100%"
          navigate={{ onClick: handleSelect }}
          rowState={r => ({ disabled: selectingId === r.externalId })}
        />
      )}
      {!loading && !isIdle && results.length === 0 && !error && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>No results.</div>
      )}
      {!isIdle && !loading && cursor && (
        <div style={{ alignSelf: 'center' }}>
          <Button variant="neutral" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading more...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
