import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { TokenizedBody, WordPopup } from '../../components/JapaneseReader.jsx'
import { NewspaperLayout, ChatLayout, DiaryLayout, InterviewLayout, LetterLayout, PostcardLayout } from './StoryLayouts.jsx'
import { Button, KANJI_FONT, BG, SURFACE } from './storyUI.jsx'
import { fieldStyle } from './storyFieldStyles.js'
import { buildVocabMap } from '../../utils/vocabMap.js'
import { FONT, TRACKING, BORDER, TEXT, TEXT_MUTED, FS_ARTICLE_BODY, FS_BASE, FS_CAPTION, FS_HEADING, FS_CONTENT_HEADING } from '../../data/theme.js'
// Cross-module write: creates cards in vocab-srs progress namespace (same pattern as ImmersionReader)
import { createCard } from '../vocab-srs/srs.js'
import { useProgress } from '../../hooks/useProgress.js'
import { supabase } from '../../lib/supabase.js'
import { gradeAnswer } from './api.js'
import { lookupVocabulary } from './lookupVocabulary.js'

const STORY_DECK_ID = 'story-words'

const FORMAT_LAYOUTS = {
  news: NewspaperLayout,
  dialogue: ChatLayout,
  diary: DiaryLayout,
  interview: InterviewLayout,
  letter: LetterLayout,
  postcard: PostcardLayout,
}

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

function Question({ q, index }) {
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState({ status: 'idle', pass: null, feedback: null, error: null })

  const check = async () => {
    if (!answer.trim() || state.status === 'grading') return
    setState({ status: 'grading', pass: null, feedback: null, error: null })
    try {
      const result = await gradeAnswer({
        question: q.question,
        correctAnswer: q.correct_answer,
        acceptableVariations: q.acceptable_variations,
        userAnswer: answer.trim(),
      })
      setState({ status: 'done', pass: result.pass, feedback: result.feedback, error: null })
    } catch (err) {
      setState({ status: 'idle', pass: null, feedback: null, error: err.message })
    }
  }

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 6 }}>Question {index + 1}</div>
      <div style={{ fontFamily: KANJI_FONT, fontSize: 17, lineHeight: 1.7, marginBottom: 12 }}>{q.question}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') check() }}
          placeholder="Type your answer in Japanese"
          disabled={state.status === 'done'}
          className="story-field" style={{ ...fieldStyle, fontFamily: KANJI_FONT, flex: 1 }}
        />
        <Button onClick={check} disabled={!answer.trim() || state.status !== 'idle'} primary>
          {state.status === 'grading' ? 'Grading…' : 'Check'}
        </Button>
      </div>
      {state.error && <div style={{ marginTop: 10, fontSize: FS_CAPTION, color: '#E05A4E' }}>{state.error}</div>}
      {state.status === 'done' && (
        <div style={{ marginTop: 12, fontSize: FS_BASE, lineHeight: 1.5 }}>
          <span style={{ color: state.pass ? '#3ABDA4' : '#E05A4E' }}>
            {state.pass ? 'Correct' : 'Not quite'}
          </span>
          <span style={{ color: TEXT_MUTED }}> — {state.feedback}</span>
          {!state.pass && (
            <div style={{ marginTop: 6, color: TEXT_MUTED }}>
              Expected: <span style={{ fontFamily: KANJI_FONT, color: TEXT }}>{q.correct_answer}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function StoryReviewPage({ storyId }) {
  const isMobile = useIsMobile()
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')

  const [story, setStory] = useState(null)
  const [storyLoading, setStoryLoading] = useState(true)
  const [storyError, setStoryError] = useState(null)

  useEffect(() => {
    setStory(null)
    setStoryError(null)
    if (!supabase) {
      setStoryError('Supabase not configured.')
      setStoryLoading(false)
      return
    }
    setStoryLoading(true)
    supabase
      .from('stories')
      .select('id, title, story, tokens, questions, format, created_at')
      .eq('id', storyId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setStoryError(err.message)
        } else {
          setStory(data)
        }
        setStoryLoading(false)
      })
  }, [storyId])

  const [vocabulary, setVocabulary] = useState([])
  const [popup, setPopup] = useState(null) // { token, vocabEntry, anchorRect, idx }
  const [showFurigana, setShowFurigana] = useState(true)

  useEffect(() => {
    setVocabulary([])
    setPopup(null)
    if (story?.tokens) {
      lookupVocabulary(story.tokens).then(setVocabulary).catch(() => setVocabulary([]))
    }
  }, [story])

  const vocabMap = useMemo(() => buildVocabMap(vocabulary), [vocabulary])

  function handleWordClick(token, e, idx) {
    const rect = e.target.getBoundingClientRect()
    setPopup({ token, vocabEntry: vocabMap[token.t] ?? null, anchorRect: rect, idx })
  }

  function handleAddToSrs(token, vocabEntry) {
    const meaning = vocabEntry?.meaning ?? token.r ?? ''
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = { ...current.decks }
    if (!decks[STORY_DECK_ID]) {
      decks[STORY_DECK_ID] = { id: STORY_DECK_ID, name: 'Story Words', active: true, source: 'imported', addedAt: Date.now() }
    }
    const cardId = `${STORY_DECK_ID}-${Date.now()}`
    const extras = {}
    if (token.r) extras.kana = token.r
    if (vocabEntry?.jmdictId) extras.jmdictId = vocabEntry.jmdictId
    const card = createCard(token.b || token.t, meaning, cardId, STORY_DECK_ID, extras)
    saveSrs({ ...current, decks, cards: { ...current.cards, [cardId]: card } })
    setPopup(null)
  }

  const crumbs = [
    { label: 'Japanese Study', href: '#/' },
    { label: 'Story generator', href: '#/story' },
    { label: 'Review story' },
  ]

  if (!story) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
        <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', fontSize: FS_HEADING, color: TEXT_MUTED }}>
          {storyLoading ? 'Loading…' : storyError || 'Story not found.'}
        </div>
      </div>
    )
  }

  const hasTokens = Array.isArray(story.tokens) && story.tokens.length > 0
  const Layout = hasTokens ? FORMAT_LAYOUTS[story.format] : null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
      {popup && (
        <WordPopup
          token={popup.token}
          vocabEntry={popup.vocabEntry}
          anchorRect={popup.anchorRect}
          onAddToSrs={handleAddToSrs}
          onClose={() => setPopup(null)}
        />
      )}
      <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
      <div style={{ flex: 1, overflowY: 'auto' }} onScroll={() => setPopup(null)}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '18px 14px 70px' : '24px 20px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {!Layout && (
              <h2 style={{ fontSize: FS_CONTENT_HEADING, fontWeight: 'normal', lineHeight: 1.5, margin: 0, flex: '1 1 200px' }}>{story.title}</h2>
            )}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              {hasTokens && (
                <button
                  className="story-btn"
                  onClick={() => setShowFurigana(f => !f)}
                  style={{
                    fontSize: FS_BASE,
                    fontFamily: FONT,
                    letterSpacing: TRACKING,
                    color: showFurigana ? TEXT : TEXT_MUTED,
                    background: showFurigana ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: `1px solid ${showFurigana ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 4,
                    padding: '3px 12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showFurigana ? 'Hide furigana' : 'Show furigana'}
                </button>
              )}
              <Button onClick={() => { window.location.hash = '#/story' }}>New content</Button>
            </div>
          </div>
          <div style={{ marginBottom: 40 }}>
            {Layout ? (
              <Layout
                title={story.title}
                tokens={story.tokens}
                vocabMap={vocabMap}
                onWordClick={handleWordClick}
                showFurigana={showFurigana}
                activeIdx={popup?.idx ?? null}
                isMobile={isMobile}
              />
            ) : (
              <div style={{
                fontSize: FS_ARTICLE_BODY,
                color: TEXT,
                fontFamily: FONT,
                letterSpacing: TRACKING,
                lineHeight: hasTokens && showFurigana ? 2.4 : 1.9,
                whiteSpace: 'pre-wrap',
              }}>
                {hasTokens
                  ? (
                    <TokenizedBody
                      tokens={story.tokens}
                      vocabMap={vocabMap}
                      onWordClick={handleWordClick}
                      showFurigana={showFurigana}
                      activeIdx={popup?.idx ?? null}
                      vocabHighlight="rgba(204,138,61,0.25)"
                    />
                  )
                  : story.story}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
            <div style={{ fontSize: FS_HEADING, color: TEXT_MUTED, marginBottom: 10 }}>Comprehension check</div>
            {story.questions.map((q, i) => <Question key={q.id || i} q={q} index={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
