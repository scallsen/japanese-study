import { useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import MediaSearch from './MediaSearch.jsx'
import EpisodeList from './EpisodeList.jsx'
import EpisodeVocabBrowser from './EpisodeVocabBrowser.jsx'
import EpisodeDrill from './EpisodeDrill.jsx'

// Self-contained module: anime lookup -> episode list -> episode vocab browser
// -> one-off drill, all as in-component state under a single #/anime-vocab
// hash route (mirrors ImmersionModule's list->reader pattern rather than
// building real route-param parsing for App.jsx).
export default function AnimeVocabModule() {
  const [media, setMedia] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [episode, setEpisode] = useState(null)
  const [drillWords, setDrillWords] = useState(null)

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
  const footerSources = ['jiten', 'dictionary', 'jlpt-vocab']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E' }}>
      <PageHeader crumbs={crumbs} rightSlot={<AuthSlot />} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {!media && <MediaSearch onSelected={handleMediaSelected} />}
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
