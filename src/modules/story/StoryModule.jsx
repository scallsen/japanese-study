import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import Button from '../../components/Button.jsx'
import Select from '../../components/Select.jsx'
import TextInput from '../../components/TextInput.jsx'
import Card from '../../components/Card.jsx'
import FeedCard from '../../components/FeedCard.jsx'
import { BG } from './storyUI.jsx'
import { labelStyle } from './storyFieldStyles.js'
import { FONT, KANJI_FONT, TRACKING, TEXT, TEXT_MUTED, FS_CAPTION, FS_HEADING, DANGER } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider } from '../../context/ModuleThemeContext.jsx'
import { WORD_SOURCES } from '../../data/wordLists.js'
import { buildLearnerContext, MATURITY_LEVELS, GRAMMAR_LEVELS } from '../../lib/learnerContext.js'
import { resolveCard } from '../vocab-srs/srs.js'
import { migrateProgress } from '../vocab-srs/migrate.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { generateStory } from './api.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const MAX_RECENT_STORIES = 20
const STORY_ACCENT = MODULES.find(m => m.id === 'story').accent

const FORMATS = [
  { id: 'story', label: 'Story' },
  { id: 'news', label: 'News article' },
  { id: 'dialogue', label: 'Dialogue transcript' },
  { id: 'diary', label: 'Diary entry' },
  { id: 'interview', label: 'Interview transcript' },
  { id: 'letter', label: 'Letter' },
  { id: 'postcard', label: 'Postcard' },
]

const FORMAT_LABEL = Object.fromEntries(FORMATS.map(f => [f.id, f.label]))

const LENGTHS = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Long' },
]

const FORMAT_OPTIONS = FORMATS.map(f => ({ value: f.id, label: f.label }))
const LENGTH_OPTIONS = LENGTHS.map(l => ({ value: l.id, label: l.label }))
const GRAMMAR_OPTIONS = GRAMMAR_LEVELS.map(g => ({ value: g, label: g }))
const MATURITY_OPTIONS = MATURITY_LEVELS.map(m => ({ value: m.id, label: m.label }))
const MODE_OPTIONS = [
  { value: 'new', label: 'New — any theme' },
  { value: 'based-on', label: 'Based on a theme, setting, or style' },
]

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function RecentCard({ entry, onClick }) {
  return (
    <FeedCard
      badges={[{ label: FORMAT_LABEL[entry.format] ?? entry.format, tone: 'neutral' }]}
      title={entry.title || 'Untitled'}
      meta={formatDate(entry.createdAt)}
      onClick={onClick}
    />
  )
}

export default function StoryModule() {
  return (
    <ModuleThemeProvider accent={STORY_ACCENT}>
      <StoryGenerator />
    </ModuleThemeProvider>
  )
}

function StoryGenerator() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { data: srsData, loading: srsLoading } = useProgress('vocab-srs')
  const srsProgress = useMemo(() => (srsData ? migrateProgress(srsData) : null), [srsData])

  const [recentStories, setRecentStories] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setRecentError('Supabase not configured.')
      setRecentLoading(false)
      return
    }
    supabase
      .from('stories')
      .select('id, title, format, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_RECENT_STORIES)
      .then(({ data, error: err }) => {
        if (err) {
          setRecentError(err.message)
        } else {
          setRecentStories((data ?? []).map(row => ({ id: row.id, title: row.title, format: row.format, createdAt: row.created_at })))
        }
        setRecentLoading(false)
      })
  }, [])

  const [source, setSourceRaw] = useState(() => safeLocalStorageGet('story-source') ?? `vocab:${WORD_SOURCES[0].id}`)
  const [maturity, setMaturityRaw] = useState(() => safeLocalStorageGet('story-maturity') ?? 'seen')
  const [grammarLevel, setGrammarRaw] = useState(() => safeLocalStorageGet('story-grammar') ?? 'N3')
  const [format, setFormatRaw] = useState(() => safeLocalStorageGet('story-format') ?? 'story')
  const [length, setLength] = useState('short')
  const [mode, setMode] = useState('new')
  const [basedOn, setBasedOn] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const showGenerating = useDelayedLoading(generating)

  const setSource = v => { setSourceRaw(v); safeLocalStorageSet('story-source', v) }
  const setMaturity = v => { setMaturityRaw(v); safeLocalStorageSet('story-maturity', v) }
  const setGrammar = v => { setGrammarRaw(v); safeLocalStorageSet('story-grammar', v) }
  const setFormat = v => { setFormatRaw(v); safeLocalStorageSet('story-format', v) }

  const srsDecks = useMemo(
    () => Object.values(srsProgress?.decks ?? {}).filter(d => d.active),
    [srsProgress],
  )

  const sourceOptions = useMemo(() => [
    ...WORD_SOURCES.map(src => ({
      label: src.label,
      options: [
        { value: `vocab:${src.id}`, label: 'All lists' },
        ...(src.lists ?? []).map(l => ({ value: `vocab:${l.id}`, label: l.label })),
      ],
    })),
    { label: 'SRS decks', options: srsDecks.map(d => ({ value: `srs:${d.id}`, label: d.name })) },
  ], [srsDecks])

  const isSrsSource = source.startsWith('srs:')

  const context = useMemo(() => {
    const sep = source.indexOf(':')
    const kind = source.slice(0, sep)
    const id = source.slice(sep + 1)
    try {
      if (kind === 'srs') {
        if (!srsProgress) return null
        const cards = Object.values(srsProgress.cards)
          .filter(c => c.deckId === id)
          .map(c => resolveCard(c))
        return buildLearnerContext('srs-deck', id, { cards, maturity, grammarLevel })
      }
      return buildLearnerContext('vocab-list', id, { grammarLevel })
    } catch {
      return null
    }
  }, [source, maturity, grammarLevel, srsProgress])

  const canGenerate =
    user && context && context.wordCount > 0 && !generating && (mode === 'new' || basedOn.trim())

  const generate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const data = await generateStory({
        learnerContext: context.text,
        mode,
        basedOn,
        format,
        length,
        questionCount: 3,
      })
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const { error: insertError } = await supabase.from('stories').insert({
        id,
        user_id: user.id,
        title: data.title,
        story: data.story,
        tokens: data.tokens,
        questions: data.questions,
        format,
        created_at: createdAt,
      })
      if (insertError) throw new Error(insertError.message)
      setRecentStories(prev => [{ id, title: data.title, format, createdAt }, ...prev].slice(0, MAX_RECENT_STORIES))
      window.location.hash = `#/story/${id}`
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
      <PageHeader
        crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Story generator' }]}
        rightSlot={<AuthSlot />}
      >
        <TopProgressBar loading={showGenerating} color={STORY_ACCENT} />
      </PageHeader>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '18px 14px 70px' : '24px 20px 80px' }}>
          <Field label="Vocabulary source">
            <Select value={source} onChange={setSource} size="md" options={sourceOptions} />
          </Field>
          {isSrsSource && !user && (
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 16 }}>Sign in to use SRS decks as a source.</div>
          )}
          {isSrsSource && user && (
            <Field label="Card maturity">
              <Select value={maturity} onChange={setMaturity} size="md" options={MATURITY_OPTIONS} />
            </Field>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Format">
                <Select value={format} onChange={setFormat} size="md" options={FORMAT_OPTIONS} />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Length">
                <Select value={length} onChange={setLength} size="md" options={LENGTH_OPTIONS} />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Grammar level">
                <Select value={grammarLevel} onChange={setGrammar} size="md" options={GRAMMAR_OPTIONS} />
              </Field>
            </div>
          </div>
          <Field label="Mode">
            <Select value={mode} onChange={setMode} size="md" options={MODE_OPTIONS} />
          </Field>
          {mode === 'based-on' && (
            <Field label="Theme / setting / style (an original piece inspired by it, not a retelling)">
              <TextInput
                value={basedOn}
                onChange={setBasedOn}
                placeholder="e.g. a slow-burn mystery in a small fishing town"
              />
            </Field>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <Button onClick={generate} disabled={!canGenerate}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
            <Button variant="neutral" onClick={() => setShowPreview(p => !p)}>
              {showPreview ? 'Hide context' : 'Preview context'}
            </Button>
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>
              {!user
                ? 'Sign in to generate stories'
                : context
                  ? `${context.wordCount} words in context`
                  : isSrsSource && srsLoading
                    ? 'Loading SRS data…'
                    : 'No words available'}
            </span>
          </div>
          {error && <div style={{ marginTop: 14, fontSize: FS_CAPTION, color: DANGER }}>{error}</div>}
          {showPreview && context && (
            <Card style={{ marginTop: 16, maxHeight: 360, overflowY: 'auto' }}>
              <pre style={{ margin: 0, fontSize: FS_CAPTION, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: KANJI_FONT }}>{context.text}</pre>
            </Card>
          )}

          <div style={{ marginTop: 36 }}>
            <div style={{ fontSize: FS_HEADING, color: TEXT_MUTED, marginBottom: 12 }}>Recent stories</div>
            {recentLoading ? (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Loading…</div>
            ) : recentError ? (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{recentError}</div>
            ) : recentStories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentStories.map(entry => (
                  <RecentCard key={entry.id} entry={entry} onClick={() => { window.location.hash = `#/story/${entry.id}` }} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>No stories generated yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
