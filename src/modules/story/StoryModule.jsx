import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { Button, KANJI_FONT, BG, SURFACE, ACCENT } from './storyUI.jsx'
import { labelStyle, fieldStyle, selectFieldStyle } from './storyFieldStyles.js'
import { FONT, TRACKING, BORDER, TEXT, TEXT_MUTED, FS_BADGE, FS_CAPTION, FS_HEADING, FS_LIST_TITLE } from '../../data/theme.js'
import { WORD_SOURCES } from '../../data/wordLists.js'
import { buildLearnerContext, MATURITY_LEVELS, GRAMMAR_LEVELS } from '../../lib/learnerContext.js'
import { resolveCard } from '../vocab-srs/srs.js'
import { migrateProgress } from '../vocab-srs/migrate.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { generateStory } from './api.js'

const MAX_RECENT_STORIES = 20

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

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(`(max-width: ${breakpoint}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

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
    <div
      className="story-recent-card"
      onClick={onClick}
      style={{
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {FORMAT_LABEL[entry.format] ?? entry.format}
        </span>
        <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginLeft: 'auto' }}>
          {formatDate(entry.createdAt)}
        </span>
      </div>
      <div style={{ fontSize: FS_LIST_TITLE, fontFamily: KANJI_FONT, lineHeight: 1.5 }}>
        {entry.title || 'Untitled'}
      </div>
    </div>
  )
}

export default function StoryModule() {
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
        <TopProgressBar loading={showGenerating} color={ACCENT} />
      </PageHeader>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '18px 14px 70px' : '24px 20px 80px' }}>
          <Field label="Vocabulary source">
            <select value={source} onChange={e => setSource(e.target.value)} className="story-field" style={selectFieldStyle}>
              {WORD_SOURCES.map(s => (
                <optgroup key={s.id} label={s.label}>
                  <option value={`vocab:${s.id}`}>All lists</option>
                  {(s.lists ?? []).map(l => (
                    <option key={l.id} value={`vocab:${l.id}`}>{l.label}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="SRS decks">
                {srsDecks.map(d => (
                  <option key={d.id} value={`srs:${d.id}`}>{d.name}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          {isSrsSource && !user && (
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 16 }}>Sign in to use SRS decks as a source.</div>
          )}
          {isSrsSource && user && (
            <Field label="Card maturity">
              <select value={maturity} onChange={e => setMaturity(e.target.value)} className="story-field" style={selectFieldStyle}>
                {MATURITY_LEVELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Format">
                <select value={format} onChange={e => setFormat(e.target.value)} className="story-field" style={selectFieldStyle}>
                  {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Length">
                <select value={length} onChange={e => setLength(e.target.value)} className="story-field" style={selectFieldStyle}>
                  {LENGTHS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Grammar level">
                <select value={grammarLevel} onChange={e => setGrammar(e.target.value)} className="story-field" style={selectFieldStyle}>
                  {GRAMMAR_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Mode">
            <select value={mode} onChange={e => setMode(e.target.value)} className="story-field" style={selectFieldStyle}>
              <option value="new">New — any theme</option>
              <option value="based-on">Based on a theme, setting, or style</option>
            </select>
          </Field>
          {mode === 'based-on' && (
            <Field label="Theme / setting / style (an original piece inspired by it, not a retelling)">
              <input
                value={basedOn}
                onChange={e => setBasedOn(e.target.value)}
                placeholder="e.g. a slow-burn mystery in a small fishing town"
                className="story-field" style={fieldStyle}
              />
            </Field>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <Button onClick={generate} disabled={!canGenerate} primary>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
            <Button onClick={() => setShowPreview(p => !p)}>
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
          {error && <div style={{ marginTop: 14, fontSize: FS_CAPTION, color: '#E05A4E' }}>{error}</div>}
          {showPreview && context && (
            <pre style={{
              marginTop: 16,
              padding: 14,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              fontSize: FS_CAPTION,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: KANJI_FONT,
              maxHeight: 360,
              overflowY: 'auto',
            }}>{context.text}</pre>
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
