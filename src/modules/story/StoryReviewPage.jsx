import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { TokenizedBody, WordPopup } from '../../components/JapaneseReader.jsx'
import { NewspaperLayout, ChatLayout, DiaryLayout, InterviewLayout, LetterLayout, PostcardLayout } from './StoryLayouts.jsx'
import Button from '../../components/Button.jsx'
import ToggleButton from '../../components/ToggleButton.jsx'
import { BG } from './storyUI.jsx'
import { buildVocabMap } from '../../utils/vocabMap.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_ARTICLE_BODY, FS_HEADING, FS_CONTENT_HEADING } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider } from '../../context/ModuleThemeContext.jsx'
// Cross-module write: creates cards in vocab-srs progress namespace (same pattern as ImmersionReader)
import { createCard } from '../vocab-srs/srs.js'
import { ensureDeck, createDeck, deleteCards } from '../vocab-srs/deckUtils.js'
import { useProgress } from '../../hooks/useProgress.js'
import { useToast } from '../../context/ToastContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { lookupVocabulary } from './lookupVocabulary.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const STORY_ACCENT = MODULES.find(m => m.id === 'story').accent

const FORMAT_LAYOUTS = {
  news: NewspaperLayout,
  dialogue: ChatLayout,
  diary: DiaryLayout,
  interview: InterviewLayout,
  letter: LetterLayout,
  postcard: PostcardLayout,
}

export default function StoryReviewPage({ storyId }) {
  return (
    <ModuleThemeProvider accent={STORY_ACCENT}>
      <StoryReview storyId={storyId} />
    </ModuleThemeProvider>
  )
}

function StoryReview({ storyId }) {
  const isMobile = useIsMobile()
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')
  const { showToast } = useToast()

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
      .select('id, title, story, tokens, format, created_at')
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

  const decks = srsData?.decks ?? {}

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

  function addWordToDeck(token, vocabEntry, deckId, decksForCreate) {
    const meaning = vocabEntry?.meaning ?? token.r ?? ''
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const newDecks = decksForCreate ?? ensureDeck(current.decks, deckId, current.decks[deckId]?.name ?? 'Deck')
    const cardId = `${deckId}-${Date.now()}`
    const extras = {}
    if (token.r) extras.kana = token.r
    if (vocabEntry?.jmdictId) extras.jmdictId = vocabEntry.jmdictId
    const card = createCard(token.b || token.t, meaning, cardId, deckId, extras)
    saveSrs({ ...current, decks: newDecks, cards: { ...current.cards, [cardId]: card } })
    setPopup(null)
    showToast({
      message: `Added to "${newDecks[deckId]?.name ?? 'Deck'}".`,
      actionLabel: 'Undo',
      onAction: () => handleUndoAdd(cardId),
    })
  }

  function handlePopupAdd(token, vocabEntry, deckId) {
    addWordToDeck(token, vocabEntry, deckId)
  }

  function handlePopupCreateAndAdd(token, vocabEntry, name) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const { decks: newDecks, deckId } = createDeck(current.decks, name)
    addWordToDeck(token, vocabEntry, deckId, newDecks)
  }

  function handleUndoAdd(cardId) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    saveSrs({ ...current, cards: deleteCards(current.cards, [cardId]) })
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
          decks={decks}
          isMobile={isMobile}
          onAdd={handlePopupAdd}
          onCreateAndAdd={handlePopupCreateAndAdd}
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
                <ToggleButton
                  active={showFurigana}
                  labels={{ on: 'Hide furigana', off: 'Show furigana' }}
                  activeTone="neutral"
                  onClick={() => setShowFurigana(f => !f)}
                />
              )}
              <Button variant="neutral" onClick={() => { window.location.hash = '#/story' }}>New content</Button>
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
                    />
                  )
                  : story.story}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
