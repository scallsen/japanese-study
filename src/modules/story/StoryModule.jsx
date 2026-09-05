import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import Button from '../../components/Button.jsx'
import Select from '../../components/Select.jsx'
import ChipSelector from '../../components/Chip.jsx'
import FeedCard from '../../components/FeedCard.jsx'
import FilterCard, { FilterRow } from '../../components/FilterCard.jsx'
import ActionBar, { ACTION_BAR_HEIGHT } from '../../components/ActionBar.jsx'
import { BG } from './storyUI.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_CAPTION, FS_HEADING, DANGER } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../../context/ModuleThemeContext.jsx'
import { AI_DAILY_LIMITS } from '../../data/aiLimits.js'
import { useAiUsage } from '../../hooks/useAiUsage.js'
import { useApiKeyStatus } from '../../hooks/useApiKeyStatus.js'
import { useAiAvailability } from '../../hooks/useAiAvailability.js'
import Notice from '../../components/Notice.jsx'
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

const STORY_LIMIT = AI_DAILY_LIMITS.find(l => l.feature === 'story-generate')?.limit ?? 0

// One pip per daily generation, filled while unspent. At five items a row of
// pips reads at a glance in a way "1 of 5" doesn't — and unlike a progress bar
// it shows the unit, which is what the user is actually rationing.
function QuotaPips({ remaining }) {
  const accent = useAccent()
  const out = remaining === 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {Array.from({ length: STORY_LIMIT }, (_, i) => (
          <span
            key={i}
            style={{
              width: 6, height: 6, borderRadius: 2,
              background: i < remaining ? accent : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </span>
      <span style={{ color: out ? DANGER : TEXT_MUTED }}>
        {out ? 'No generations left today' : `${remaining} of ${STORY_LIMIT} left today`}
      </span>
    </span>
  )
}

function StoryList({ title, stories, empty }) {
  return (
    <div>
      <div style={{ fontSize: FS_HEADING, color: TEXT_MUTED, marginBottom: 12 }}>{title}</div>
      {stories.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stories.map(entry => (
            <RecentCard key={entry.id} entry={entry} onClick={() => { window.location.hash = `#/story/${entry.id}` }} />
          ))}
        </div>
      ) : empty ? (
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{empty}</div>
      ) : null}
    </div>
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

  const { usage: aiUsage, refresh: refreshUsage } = useAiUsage()
  const { hasKey: usingOwnKey, loading: apiKeyLoading } = useApiKeyStatus()
  const aiAvailable = useAiAvailability('story-generate')
  const storyRemaining = Math.max(0, STORY_LIMIT - (aiUsage.today['story-generate'] ?? 0))

  const [myStories, setMyStories] = useState([])
  const [exampleStories, setExampleStories] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState(null)

  // Two queries rather than one filtered client-side: a single limited query
  // would let a long list of examples crowd out the user's own stories.
  // RLS already restricts reads to own + shared, so this only shapes the split.
  useEffect(() => {
    if (!supabase) {
      setRecentError('Supabase not configured.')
      setRecentLoading(false)
      return
    }
    let cancelled = false
    setRecentLoading(true)

    const COLUMNS = 'id, title, format, created_at'
    const mapRow = row => ({ id: row.id, title: row.title, format: row.format, createdAt: row.created_at })
    const query = () => supabase.from('stories').select(COLUMNS).order('created_at', { ascending: false }).limit(MAX_RECENT_STORIES)

    const mine = user ? query().eq('user_id', user.id) : Promise.resolve({ data: [], error: null })
    const examples = query().eq('shared', true)

    Promise.all([mine, examples]).then(([m, e]) => {
      if (cancelled) return
      const err = m.error || e.error
      if (err) {
        setRecentError(err.message)
      } else {
        const own = (m.data ?? []).map(mapRow)
        const ownIds = new Set(own.map(s => s.id))
        setMyStories(own)
        setExampleStories((e.data ?? []).map(mapRow).filter(s => !ownIds.has(s.id)))
      }
      setRecentLoading(false)
    })

    return () => { cancelled = true }
  }, [user])

  const [source, setSourceRaw] = useState(() => safeLocalStorageGet('story-source') ?? `vocab:${WORD_SOURCES[0].id}`)
  const [maturity, setMaturityRaw] = useState(() => safeLocalStorageGet('story-maturity') ?? 'seen')
  const [grammarLevel, setGrammarRaw] = useState(() => safeLocalStorageGet('story-grammar') ?? 'N3')
  const [format, setFormatRaw] = useState(() => safeLocalStorageGet('story-format') ?? 'story')
  const [length, setLength] = useState('short')
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

  // Blocking here rather than letting the server 429 turns a wasted round trip
  // and a raw error into a disabled button the user can see the reason for.
  // Someone on their own key isn't metered at all, so the daily count must not
  // gate them — otherwise a spent quota would lock out a user who isn't
  // spending ours.
  // The server is what actually enforces this; disabling the button just avoids
  // sending a request that can only come back as a 429.
  const canGenerate = user && context && context.wordCount > 0 && !generating && aiAvailable
    && (usingOwnKey || storyRemaining > 0)

  const generate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const data = await generateStory({
        learnerContext: context.text,
        // The "based on a theme" mode was dropped from the UI (to be
        // reassessed); the edge function still accepts it.
        mode: 'new',
        basedOn: '',
        format,
        length,
      })
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const { error: insertError } = await supabase.from('stories').insert({
        id,
        user_id: user.id,
        title: data.title,
        story: data.story,
        tokens: data.tokens,
        format,
        created_at: createdAt,
      })
      if (insertError) throw new Error(insertError.message)
      setMyStories(prev => [{ id, title: data.title, format, createdAt }, ...prev].slice(0, MAX_RECENT_STORIES))
      refreshUsage()
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
        <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? `18px 14px ${ACTION_BAR_HEIGHT + 18}px` : `24px 20px ${ACTION_BAR_HEIGHT + 24}px` }}>
          <FilterCard>
            <FilterRow key="source" label="Vocabulary">
              <Select value={source} onChange={setSource} variant="inline" options={sourceOptions} />
              {isSrsSource && !user && (
                <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 8 }}>Sign in to use SRS decks as a source.</div>
              )}
            </FilterRow>
            {isSrsSource && user && (
              <FilterRow key="maturity" label="Maturity">
                <ChipSelector mode="single" options={MATURITY_OPTIONS} value={maturity} onChange={setMaturity} />
              </FilterRow>
            )}
            <FilterRow key="format" label="Format">
              <Select value={format} onChange={setFormat} variant="inline" options={FORMAT_OPTIONS} />
            </FilterRow>
            <FilterRow key="length" label="Length">
              <ChipSelector mode="single" options={LENGTH_OPTIONS} value={length} onChange={setLength} />
            </FilterRow>
            <FilterRow key="grammar" label="Grammar">
              <ChipSelector mode="single" options={GRAMMAR_OPTIONS} value={grammarLevel} onChange={setGrammar} />
            </FilterRow>
          </FilterCard>

          {!aiAvailable && (
            <Notice style={{ marginTop: 14 }} title="AI generation is temporarily unavailable">
              The app has reached its daily limit for AI generation. It resets tomorrow.
              You can generate without limit by adding your own Anthropic API key on your account page.
            </Notice>
          )}
          {error && <div style={{ marginTop: 14, fontSize: FS_CAPTION, color: DANGER }}>{error}</div>}
          <ActionBar
            maxWidth={760}
            leading={(
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span>
                  {!user
                    ? 'Sign in to generate stories'
                    : context
                      ? `${context.wordCount} words in context`
                      : isSrsSource && srsLoading
                        ? 'Loading SRS data…'
                        : 'No words available'}
                </span>
                {/* Held back until the key status resolves, so a user on their
                    own key never sees a quota line flash first. */}
                {user && !apiKeyLoading && (
                  usingOwnKey
                    ? <span>Using your own API key</span>
                    : <QuotaPips remaining={storyRemaining} />
                )}
              </span>
            )}
          >
            <Button size="xl" onClick={generate} disabled={!canGenerate}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </ActionBar>

          <div style={{ marginTop: 36 }}>
            {recentLoading ? (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Loading…</div>
            ) : recentError ? (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{recentError}</div>
            ) : (
              <>
                <StoryList
                  title="Your stories"
                  stories={myStories}
                  empty={user ? 'No stories generated yet.' : 'Sign in to generate and keep your own stories.'}
                />
                {exampleStories.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <StoryList title="Examples" stories={exampleStories} empty={null} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
