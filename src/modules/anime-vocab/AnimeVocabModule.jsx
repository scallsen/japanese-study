import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import MediaSearch from './MediaSearch.jsx'
import EpisodeList from './EpisodeList.jsx'
import EpisodeVocabBrowser from './EpisodeVocabBrowser.jsx'
import EpisodeDrill from './EpisodeDrill.jsx'
import TrackedAnimeSection from './TrackedAnimeSection.jsx'
import RecommendedCarousel from './RecommendedCarousel.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { FONT, TRACKING } from '../../data/theme.js'

const ACCENT = '#D46EA3'

// Self-contained module: anime lookup -> episode list -> episode vocab browser
// -> one-off drill, all as in-component state under a single #/anime-vocab
// hash route (mirrors ImmersionModule's list->reader pattern rather than
// building real route-param parsing for App.jsx), plus an optional
// #/anime-vocab/:mediaId route (initialMediaId) that resumes straight into
// a tracked series' episode list.
export default function AnimeVocabModule({ initialMediaId }) {
  const [media, setMedia] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [episode, setEpisode] = useState(null)
  const [drillWords, setDrillWords] = useState(null)
  const [resolving, setResolving] = useState(!!initialMediaId)
  const [childLoading, setChildLoading] = useState(false)
  const { tracked, loading: trackedLoading, untrack } = useTrackedAnime()
  const hasTrackedItems = Object.keys(tracked).length > 0

  const showProgressBar = useDelayedLoading(resolving || childLoading)
  const showResolvingMessage = useDelayedLoading(resolving)

  useEffect(() => {
    if (!initialMediaId) return
    let cancelled = false
    setResolving(true)
    async function resolve() {
      const { data: mediaRow } = await supabase
        .from('media').select('id, title, media_type, cover_url, difficulty').eq('id', initialMediaId).maybeSingle()
      if (cancelled) return
      if (!mediaRow) { setResolving(false); return }
      const { data: episodeRows } = await supabase
        .from('media_episode').select('*').eq('media_id', initialMediaId).order('episode_number', { ascending: true })
      if (cancelled) return
      setMedia({
        id: mediaRow.id, title: mediaRow.title, mediaType: mediaRow.media_type,
        coverUrl: mediaRow.cover_url, difficulty: mediaRow.difficulty,
      })
      setEpisodes(episodeRows ?? [])
      setResolving(false)
    }
    resolve()
    return () => { cancelled = true }
  }, [initialMediaId])

  function handleMediaSelected(selectedMedia, selectedEpisodes) {
    setMedia(selectedMedia)
    setEpisodes(selectedEpisodes)
  }

  function backToSearch() {
    setMedia(null)
    setEpisodes([])
    setEpisode(null)
    setDrillWords(null)
  }

  function backToEpisodes() {
    setEpisode(null)
    setDrillWords(null)
  }

  function backToBrowser() {
    setDrillWords(null)
  }

  const crumbs = [{ label: 'Japanese Study', href: '#/' }]
  if (!media) {
    crumbs.push({ label: 'Anime Vocab' })
  } else if (!episode) {
    crumbs.push({ label: 'Anime Vocab', onClick: backToSearch })
    crumbs.push({ label: media.title })
  } else if (!drillWords) {
    crumbs.push({ label: 'Anime Vocab', onClick: backToSearch })
    crumbs.push({ label: media.title, onClick: backToEpisodes })
    crumbs.push({ label: episode.title || `Episode ${episode.episode_number}` })
  } else {
    crumbs.push({ label: 'Anime Vocab', onClick: backToSearch })
    crumbs.push({ label: media.title, onClick: backToEpisodes })
    crumbs.push({ label: episode.title || `Episode ${episode.episode_number}`, onClick: backToBrowser })
    crumbs.push({ label: 'Drill' })
  }

  const showFooter = !!episode
  const showDrillBar = !!(media && episode && !drillWords)
  const footerSources = ['jiten', 'dictionary', 'jlpt-vocab']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING }}>
      <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />}>
        <TopProgressBar loading={showProgressBar} color={ACCENT} />
      </PageHeader>
      <div style={{ flex: 1, overflowY: 'auto', padding: showDrillBar ? '32px 24px 84px' : '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {resolving && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {showResolvingMessage && <CenteredLoadingMessage text="Loading series details" />}
            </div>
          )}
          {!resolving && !media && (
            <>
              {!trackedLoading && hasTrackedItems && <TrackedAnimeSection tracked={tracked} untrack={untrack} />}
              {!trackedLoading && !hasTrackedItems && (
                <RecommendedCarousel onSelected={handleMediaSelected} onLoadingChange={setChildLoading} />
              )}
              <MediaSearch onSelected={handleMediaSelected} onLoadingChange={setChildLoading} />
            </>
          )}
          {media && !episode && <EpisodeList media={media} episodes={episodes} onSelectEpisode={setEpisode} />}
          {media && episode && !drillWords && (
            <EpisodeVocabBrowser media={media} episode={episode} onStartDrill={setDrillWords} onLoadingChange={setChildLoading} />
          )}
          {media && episode && drillWords && (
            <EpisodeDrill words={drillWords} onBack={backToBrowser} />
          )}
        </div>
        {showFooter && <AttributionFooter sources={footerSources} />}
      </div>
    </div>
  )
}
