import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import FeedCard from '../../components/FeedCard.jsx'
import Japanese from '../../components/Japanese.jsx'
import SectionHeader from '../../components/SectionHeader.jsx'
import ChipSelector from '../../components/Chip.jsx'
import TextInput from '../../components/TextInput.jsx'
import Button from '../../components/Button.jsx'
import FilterCard, { FilterRow } from '../../components/FilterCard.jsx'
import ImmersionReader from './ImmersionReader.jsx'
import { supabase } from '../../lib/supabase.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider } from '../../context/ModuleThemeContext.jsx'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE, SPACE_8, SPACE_12, SPACE_16 } from '../../data/theme.js'
import { CATEGORIES, CATEGORY_LABEL } from './categories.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'

const IMMERSION_ACCENT = MODULES.find(m => m.id === 'immersion').accent

const CATEGORY_OPTIONS = [{ value: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ value: c.id, label: c.label }))]
const LEVEL_OPTIONS = [{ value: 'simplified', label: 'Simple' }, { value: 'original', label: 'Intermediate' }]
const ARTICLE_COLUMNS = 'id, slug, source, title, title_simple, title_en, published_at, body_ja, body_simple, summary_en, questions, difficulty, category, tokens_ja, tokens_simple, vocabulary_ja'
const PAGE_SIZE = 12
const DEFAULT_LEVEL_KEY = 'immersion-default-level'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// `.or()` filter strings are comma-separated PostgREST clauses — a raw comma
// or paren in the search term would break the clause boundary rather than
// just fail to match, so strip them before interpolating.
function sanitizeSearchTerm(term) {
  return term.replace(/[,()]/g, '').trim()
}

function ArticleCard({ article, level, onClick, isRead }) {
  const badges = article.category ? [{ label: CATEGORY_LABEL[article.category] ?? article.category, tone: 'accent' }] : []
  const title = level === 'simplified' ? (article.title_simple ?? article.title) : article.title
  return (
    <FeedCard
      badges={badges}
      title={<Japanese>{title}</Japanese>}
      subtitle={article.title_en}
      meta={formatDate(article.published_at)}
      read={isRead}
      onClick={onClick}
    />
  )
}

export default function ImmersionModule() {
  return (
    <ModuleThemeProvider accent={IMMERSION_ACCENT}>
      <ImmersionScreens />
    </ModuleThemeProvider>
  )
}

// Split from the export so the provider wraps *both* screens — the reader is
// returned early from the same component, and wrapping only the list branch
// would leave the reader's chips/toggles on the core teal.
function ImmersionScreens() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [category, setCategory] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [defaultLevel, setDefaultLevel] = useState(() => safeLocalStorageGet(DEFAULT_LEVEL_KEY) ?? 'simplified')

  const [featured, setFeatured] = useState([])
  const [list, setList] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const { data: progressData, save: saveProgress } = useProgress('immersion')
  const showLoadingMessage = useDelayedLoading(loading)
  const requestIdRef = useRef(0)

  const readSet = new Set(Object.keys(progressData?.read ?? {}))
  const showFeatured = category === 'all' && !search

  function markRead(slug) {
    if (readSet.has(slug)) return
    saveProgress({
      ...progressData,
      read: {
        ...(progressData?.read ?? {}),
        [slug]: { readAt: new Date().toISOString(), score: null },
      },
    })
  }

  function handleLevelChange(next) {
    setDefaultLevel(next)
    safeLocalStorageSet(DEFAULT_LEVEL_KEY, next)
  }

  // Opening an article marks it read — no explicit "Mark as read" control
  // anymore. Gated on `user` (mirroring the old signed-out "Sign in to save
  // reading history" prompt, which never offered marking at all when
  // signed out); `markRead` itself de-dupes against readSet.
  useEffect(() => {
    if (user && selectedArticle) markRead(selectedArticle.slug)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArticle, user])

  // Debounce free-text search so every keystroke doesn't fire a query.
  useEffect(() => {
    const t = setTimeout(() => setSearch(sanitizeSearchTerm(searchInput)), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Featured strip is the 3 most recent articles overall, independent of
  // category/search — it's the "home" state's own section, fetched once.
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('active', true)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, 2)
      .then(({ data, error: err }) => {
        if (!err) setFeatured(data ?? [])
      })
  }, [])

  // Main list — refetches from page 0 whenever the category or search
  // changes. When on the unfiltered "all" view, the list picks up right
  // after the 3 featured articles above so they aren't shown twice.
  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured.')
      setLoading(false)
      return
    }
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setPage(0)

    let q = supabase.from('articles').select(ARTICLE_COLUMNS).eq('active', true)
    if (category !== 'all') q = q.eq('category', category)
    if (search) q = q.or(`title_en.ilike.%${search}%,summary_en.ilike.%${search}%,title.ilike.%${search}%,title_simple.ilike.%${search}%`)
    const offsetBase = category === 'all' && !search ? 3 : 0
    q = q.order('published_at', { ascending: false }).order('id', { ascending: false }).range(offsetBase, offsetBase + PAGE_SIZE - 1)

    q.then(({ data, error: err }) => {
      if (requestId !== requestIdRef.current) return
      if (err) {
        setError(err.message)
      } else {
        setList(data ?? [])
        setHasMore((data ?? []).length === PAGE_SIZE)
      }
      setLoading(false)
    })
  }, [category, search])

  function handleLoadMore() {
    if (!supabase || loadingMore) return
    const nextPage = page + 1
    const offsetBase = category === 'all' && !search ? 3 : 0
    const from = offsetBase + nextPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase.from('articles').select(ARTICLE_COLUMNS).eq('active', true)
    if (category !== 'all') q = q.eq('category', category)
    if (search) q = q.or(`title_en.ilike.%${search}%,summary_en.ilike.%${search}%,title.ilike.%${search}%,title_simple.ilike.%${search}%`)
    q = q.order('published_at', { ascending: false }).order('id', { ascending: false }).range(from, to)

    setLoadingMore(true)
    q.then(({ data, error: err }) => {
      setLoadingMore(false)
      if (err) return
      setPage(nextPage)
      setList(prev => [...prev, ...(data ?? [])])
      setHasMore((data ?? []).length === PAGE_SIZE)
    })
  }

  if (selectedArticle) {
    return (
      <ImmersionReader
        article={selectedArticle}
        defaultLevel={defaultLevel}
        onBack={() => setSelectedArticle(null)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E' }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'News reader' },
        ]}
        rightSlot={<AuthSlot />}
      >
        <TopProgressBar loading={showLoadingMessage} color={IMMERSION_ACCENT} />
      </PageHeader>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SPACE_16 }}>
          <TextInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search articles"
            size="lg"
          />
          <div style={{ fontSize: FS_BASE - 2, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7, marginTop: -SPACE_8 }}>
            Articles are written by AI based on real news topics and may contain inaccuracies.
          </div>

          <FilterCard>
            <FilterRow key="topic" label="Topic">
              <ChipSelector mode="single" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
            </FilterRow>
            <FilterRow key="difficulty" label="Difficulty">
              <ChipSelector mode="single" options={LEVEL_OPTIONS} value={defaultLevel} onChange={handleLevelChange} />
            </FilterRow>
          </FilterCard>

          {showFeatured && featured.length > 0 && (
            <div>
              <SectionHeader title="Featured" />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: SPACE_12 }}>
                {featured.map(article => (
                  <ArticleCard
                    key={article.slug}
                    article={article}
                    level={defaultLevel}
                    onClick={() => setSelectedArticle(article)}
                    isRead={readSet.has(article.slug)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionHeader title={showFeatured ? 'Latest' : (category === 'all' ? 'Search results' : CATEGORY_LABEL[category] ?? category)} marginTop={showFeatured ? 8 : 0} />
            {loading ? (
              showLoadingMessage && <CenteredLoadingMessage text="Loading articles" />
            ) : error ? (
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                {error}
              </div>
            ) : list.length === 0 ? (
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                {search ? 'No articles match your search.' : 'No articles yet.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
                {list.map(article => (
                  <ArticleCard
                    key={article.slug}
                    article={article}
                    level={defaultLevel}
                    onClick={() => setSelectedArticle(article)}
                    isRead={readSet.has(article.slug)}
                  />
                ))}
              </div>
            )}
            {!loading && !error && hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: SPACE_16 }}>
                <Button variant="neutral" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
