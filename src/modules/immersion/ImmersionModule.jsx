import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import FeedCard from '../../components/FeedCard.jsx'
import ImmersionReader from './ImmersionReader.jsx'
import { supabase } from '../../lib/supabase.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider } from '../../context/ModuleThemeContext.jsx'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE } from '../../data/theme.js'

const IMMERSION_ACCENT = MODULES.find(m => m.id === 'immersion').accent

const DIFFICULTY_LABEL = { 1: 'N5', 2: 'N4', 3: 'N3', 4: 'N2', 5: 'N1' }
const SOURCE_LABEL = { news: 'News', yahoo: 'News', nhk: 'NHK Easy', tadoku: 'Tadoku' }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ArticleCard({ article, onClick, isRead }) {
  const badges = [{ label: SOURCE_LABEL[article.source] ?? article.source ?? 'News', tone: 'accent' }]
  if (article.difficulty) badges.push({ label: DIFFICULTY_LABEL[article.difficulty] ?? '—', tone: 'neutral' })
  return (
    <FeedCard
      badges={badges}
      title={article.title}
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
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { data: progressData, save: saveProgress } = useProgress('immersion')
  const showLoadingMessage = useDelayedLoading(loading)

  const readSet = new Set(Object.keys(progressData?.read ?? {}))

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

  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured.')
      setLoading(false)
      return
    }
    supabase
      .from('articles')
      .select('id, slug, source, title, title_en, published_at, body_ja, body_simple, summary_en, questions, difficulty, tokens_ja, tokens_simple, vocabulary_ja')
      .eq('active', true)
      .order('published_at', { ascending: false })
      .limit(10)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else {
          setArticles(data ?? [])
        }
        setLoading(false)
      })
  }, [])

  if (selectedArticle) {
    return (
      <ImmersionReader
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        isRead={readSet.has(selectedArticle.slug)}
        onMarkRead={() => markRead(selectedArticle.slug)}
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
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            showLoadingMessage && <CenteredLoadingMessage text="Loading articles" />
          ) : error ? (
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {error}
            </div>
          ) : articles.length === 0 ? (
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              No articles yet.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                  Recent reading — {articles.length} {articles.length === 1 ? 'item' : 'items'}
                </div>
              </div>
              {articles.map(article => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  onClick={() => setSelectedArticle(article)}
                  isRead={readSet.has(article.slug)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
