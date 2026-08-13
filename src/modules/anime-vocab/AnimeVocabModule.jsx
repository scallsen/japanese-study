import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import MediaSearch from './MediaSearch.jsx'
import EpisodeList from './EpisodeList.jsx'
import EpisodeVocabBrowser from './EpisodeVocabBrowser.jsx'
import EpisodeDrill from './EpisodeDrill.jsx'
import TrackedAnimeSection from './TrackedAnimeSection.jsx'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE } from '../../data/theme.js'

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

  useEffect(() => {
    if (!initialMediaId) return
    let cancelled = false
    setResolving(true)
    async function resolve() {
      const { data: mediaRow } = await supabase.from('media').select('id, title, media_type').eq('id', initialMediaId).maybeSingle()
      if (cancelled) return
      if (!mediaRow) { setResolving(false); return }
      const { data: episodeRows } = await supabase
        .from('media_episode').select('*').eq('media_id', initialMediaId).order('episode_number', { ascending: true })
      if (cancelled) return
      setMedia({ id: mediaRow.id, title: mediaRow.title, mediaType: mediaRow.media_type })
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
      <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
      <div style={{ flex: 1, overflowY: 'auto', padding: showDrillBar ? '32px 24px 84px' : '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {resolving && (
            <div style={{ maxWidth: 640, margin: '0 auto', fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              Loading...
            </div>
          )}
          {!resolving && !media && (
            <>
              <TrackedAnimeSection />
              <MediaSearch onSelected={handleMediaSelected} />
            </>
          )}
          {media && !episode && <EpisodeList media={media} episodes={episodes} onSelectEpisode={setEpisode} />}
          {media && episode && !drillWords && (
            <EpisodeVocabBrowser media={media} episode={episode} onStartDrill={setDrillWords} />
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
