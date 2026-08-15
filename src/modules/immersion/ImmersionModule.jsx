import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import ImmersionReader from './ImmersionReader.jsx'
import { supabase } from '../../lib/supabase.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#E05A4E'

const DIFFICULTY_LABEL = { 1: 'N5', 2: 'N4', 3: 'N3', 4: 'N2', 5: 'N1' }
const SOURCE_LABEL = { yahoo: 'Yahoo News', nhk: 'NHK Easy', tadoku: 'Tadoku' }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ArticleCard({ article, onClick, isRead }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#313131' : '#2A2A2A',
        border: `1px solid ${isRead ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 8,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'background 130ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{
          fontSize: FS_BADGE,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          color: ACCENT,
          background: `${ACCENT}22`,
          border: `1px solid ${ACCENT}55`,
          borderRadius: 4,
          padding: '1px 7px',
        }}>
          {SOURCE_LABEL[article.source] ?? article.source ?? 'News'}
        </span>
        {article.difficulty && (
          <span style={{
            fontSize: FS_BADGE,
            fontFamily: FONT,
            letterSpacing: TRACKING,
            color: TEXT_MUTED,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '1px 7px',
          }}>
            {DIFFICULTY_LABEL[article.difficulty] ?? '—'}
          </span>
        )}
        <span style={{
          fontSize: FS_CAPTION,
          color: TEXT_MUTED,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {isRead && <span style={{ color: '#6BCB6B', fontSize: FS_CAPTION }}>✓</span>}
          {formatDate(article.published_at)}
        </span>
      </div>
      <div style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.5 }}>
        {article.title}
      </div>
      {article.title_en && (
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {article.title_en}
        </div>
      )}
    </div>
  )
}

export default function ImmersionModule() {
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
        <TopProgressBar loading={showLoadingMessage} color={ACCENT} />
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
