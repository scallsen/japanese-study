import { useState, useEffect } from 'react'
import DashboardPage from './pages/DashboardPage.jsx'
import VocabPage from './pages/VocabPage.jsx'
import VocabSrsModule from './modules/vocab-srs/VocabSrsModule.jsx'
import VocabSrsBrowsePage from './modules/vocab-srs/VocabSrsBrowsePage.jsx'
import ImmersionModule from './modules/immersion/ImmersionModule.jsx'
import GrammarMapModule from './modules/grammar-map/GrammarMapModule.jsx'
import StoryModule from './modules/story/StoryModule.jsx'
import StoryReviewPage from './modules/story/StoryReviewPage.jsx'
import DictionaryPage from './pages/DictionaryPage.jsx'
import DictionaryEntryPage from './pages/DictionaryEntryPage.jsx'
import AnimeVocabModule from './modules/anime-vocab/AnimeVocabModule.jsx'
import DeckPickerLabPage from './pages/DeckPickerLabPage.jsx'
import ToastLabPage from './pages/ToastLabPage.jsx'
import StyleGuideLabPage from './pages/StyleGuideLabPage.jsx'

function getRoute() {
  // Strip any query string (e.g. '/vocab-srs/browse?deck=x&manage=1') before
  // matching — routes below compare on path only; pages that need the query
  // read window.location.hash directly.
  return window.location.hash.slice(1).split('?')[0] || '/'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const root = document.getElementById('root')
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    root.style.height = '100%'
  }, [])

  useEffect(() => {
    const handler = () => setRoute(getRoute())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (route === '/') return <DashboardPage />
  if (route === '/vocab') return <VocabPage />
  if (route === '/vocab-srs') return <VocabSrsModule />
  if (route === '/vocab-srs/browse') return <VocabSrsBrowsePage />
  if (route === '/immersion') return <ImmersionModule />
  if (route === '/grammar-map') return <GrammarMapModule />
  if (route === '/story') return <StoryModule />
  if (route.startsWith('/story/')) return <StoryReviewPage storyId={route.slice('/story/'.length)} />
  if (route === '/dictionary') return <DictionaryPage />
  if (route.startsWith('/dictionary/entry/')) return <DictionaryEntryPage entryId={route.slice('/dictionary/entry/'.length)} />
  if (route === '/anime-vocab') return <AnimeVocabModule />
  if (route.startsWith('/anime-vocab/')) return <AnimeVocabModule initialMediaId={route.slice('/anime-vocab/'.length)} />
  // Temporary dev-only comparison harness for the SRS deck-picker UX, not linked from the dashboard
  if (route === '/dev/deck-picker-lab') return <DeckPickerLabPage />
  // Temporary dev-only comparison harness for the add-confirmation toast UX, not linked from the dashboard
  if (route === '/dev/toast-lab') return <ToastLabPage />
  // Living style guide for shared components (DataList, and whatever joins it next), not linked from the dashboard
  if (route === '/dev/style-guide') return <StyleGuideLabPage />
  return <DashboardPage />
}
