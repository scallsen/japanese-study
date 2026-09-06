import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import SettingsSidebar, { SidebarHeaderToggle } from '../../components/SettingsSidebar.jsx'
import DrillSettingsPanel from '../../components/DrillSettingsPanel.jsx'
import { useDrillSettings } from '../../hooks/useDrillSettings.js'
import MediaSearch from './MediaSearch.jsx'
import EpisodeList from './EpisodeList.jsx'
import EpisodeVocabBrowser from './EpisodeVocabBrowser.jsx'
import EpisodeDrill from './EpisodeDrill.jsx'
import TrackedAnimeSection from './TrackedAnimeSection.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { useJaVoices } from '../../hooks/useTTS.js'
import { FONT, TRACKING } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../../context/ModuleThemeContext.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const ANIME_ACCENT = MODULES.find(m => m.id === 'anime-vocab').accent

// Duplicated per-file (matches this module's own established convention —
// see e.g. GrammarMapModule.jsx, VocabSrsModule.jsx, StoryModule.jsx — each
// self-contained module keeps its own small copy rather than a shared hook).

// Self-contained module: anime lookup -> episode list -> episode vocab browser
// -> one-off drill, all as in-component state under a single #/anime-vocab
// hash route (mirrors ImmersionModule's list->reader pattern rather than
// building real route-param parsing for App.jsx), plus an optional
// #/anime-vocab/:mediaId route (initialMediaId) that resumes straight into
// a tracked series' episode list.
export default function AnimeVocabModule({ initialMediaId }) {
  // Explicit override, not ambient useAccent() — this component is the one
  // establishing ModuleThemeProvider below, so it can't read back the value
  // it's about to provide to its own children.
  const ACCENT = useAccent(ANIME_ACCENT)
  const [media, setMedia] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [episode, setEpisode] = useState(null)
  const [drillWords, setDrillWords] = useState(null)
  const [resolving, setResolving] = useState(!!initialMediaId)
  const [childLoading, setChildLoading] = useState(false)
  const { tracked, loading: trackedLoading, untrack } = useTrackedAnime()
  const hasTrackedItems = Object.keys(tracked).length > 0
  const isMobile = useIsMobile()
  const jaVoices = useJaVoices()

  const showProgressBar = useDelayedLoading(resolving || childLoading)
  const showResolvingMessage = useDelayedLoading(resolving)

  // Drill display/audio settings — owned here (not by EpisodeDrill) so the
  // settings sidebar can be hosted at this module's top level, the same way
  // VocabPage hosts its own sidebar at the page level rather than inside its
  // ActiveDrill child. That's what lets the sidebar span the module's full
  // height and sit flush against the true right edge, instead of being
  // boxed in by the scrollable content area's padding.
  //
  // Reuses Vocab Drill's own localStorage keys (vocab-*) rather than a
  // separate anime-vocab-* namespace, so display/audio preferences carry
  // over between the two drills automatically, in both directions.
  const [showOptions, setShowOptions] = useState(false)
  const { settings, set: setSetting } = useDrillSettings('vocab')

  useEffect(() => {
    if (!initialMediaId) return
    let cancelled = false
    setResolving(true)
    async function resolve() {
      const { data: mediaRow } = await supabase
        .from('media')
        .select('id, title, media_type, cover_url, difficulty, original_title, description, tags, links, relationships')
        .eq('id', initialMediaId).maybeSingle()
      if (cancelled) return
      if (!mediaRow) { setResolving(false); return }
      const { data: episodeRows } = await supabase
        .from('media_episode').select('*').eq('media_id', initialMediaId).order('episode_number', { ascending: true })
      if (cancelled) return
      const { data: ref } = await supabase
        .from('media_provider_ref').select('external_id').eq('media_id', initialMediaId).eq('provider', 'jiten').maybeSingle()
      if (cancelled) return
      setMedia({
        id: mediaRow.id, title: mediaRow.title, mediaType: mediaRow.media_type,
        coverUrl: mediaRow.cover_url, difficulty: mediaRow.difficulty, externalId: ref?.external_id ?? null,
        originalTitle: mediaRow.original_title, description: mediaRow.description,
        tags: mediaRow.tags, links: mediaRow.links, relationships: mediaRow.relationships,
      })
      setEpisodes(episodeRows ?? [])
      setResolving(false)
    }
    resolve()
    return () => { cancelled = true }
  }, [initialMediaId])

  // All four screens swap inside one persistent scroll container, so without
  // this the outgoing screen's scroll offset carries into the incoming one —
  // picking a series from far down the search results lands you mid-page on
  // its episode list. The search screen is the exception: it stays mounted
  // precisely so a round trip preserves its state (see the render below), so
  // its offset is saved on the way out and restored on the way back rather
  // than reset. Captured at click time, not in the effect, since by the time
  // the effect runs the container has already been re-measured against the
  // incoming screen's (possibly shorter) content and clamped.
  const scrollRef = useRef(null)
  const searchScrollTop = useRef(0)
  const viewKey = drillWords ? 'drill' : episode ? `episode:${episode.id}` : media ? `media:${media.id}` : 'search'
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = viewKey === 'search' ? searchScrollTop.current : 0
  }, [viewKey])

  function handleMediaSelected(selectedMedia, selectedEpisodes) {
    searchScrollTop.current = scrollRef.current?.scrollTop ?? 0
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
    crumbs.push({ label: 'Anime vocabulary' })
  } else if (!episode) {
    crumbs.push({ label: 'Anime vocabulary', onClick: backToSearch })
    crumbs.push({ label: media.title })
  } else if (!drillWords) {
    crumbs.push({ label: 'Anime vocabulary', onClick: backToSearch })
    crumbs.push({ label: media.title, onClick: backToEpisodes })
    crumbs.push({ label: episode.title || `Episode ${episode.episode_number}` })
  } else {
    crumbs.push({ label: 'Anime vocabulary', onClick: backToSearch })
    crumbs.push({ label: media.title, onClick: backToEpisodes })
    crumbs.push({ label: episode.title || `Episode ${episode.episode_number}`, onClick: backToBrowser })
    crumbs.push({ label: 'Drill' })
  }

  // The index/search screen and the detail view (EpisodeList) only ever show
  // Jiten-sourced text (titles/covers/description/tags/difficulty) —
  // dictionary/JLPT-vocab credit only applies once episode/drill screens
  // start rendering per-word definitions.
  const showFooter = !resolving
  const showDrillBar = !!(media && episode && !drillWords)
  const showDrillSettings = !!(media && episode && drillWords)
  const footerSources = episode ? ['jiten', 'dictionary', 'jlpt-vocab'] : ['jiten']

  function renderSettingsPanel(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>
        {/* No Voice row: these words come out of subtitles on demand, so no
            recordings exist for any of them and the backup voice reads every
            card. */}
        <DrillSettingsPanel
          settings={settings}
          onChange={setSetting}
          hasRecordedVoices={false}
          backupVoices={jaVoices}
        />
      </div>
    )
  }

  return (
    <ModuleThemeProvider accent={ANIME_ACCENT}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING }}>
      <PageHeader
        crumbs={crumbs}
        rightSlot={(
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AuthSlot />
            {isMobile && <SidebarHeaderToggle onClick={() => setShowOptions(true)} />}
          </div>
        )}
      >
        <TopProgressBar loading={showProgressBar} color={ACCENT} />
      </PageHeader>
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: showDrillBar ? '32px 24px 84px' : '32px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {resolving && (
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {showResolvingMessage && <CenteredLoadingMessage text="Loading series details" />}
              </div>
            )}
            {!resolving && !media && !trackedLoading && hasTrackedItems && (
              <TrackedAnimeSection tracked={tracked} untrack={untrack} />
            )}
            {!resolving && (
              // Stays mounted (just hidden) once past the resolving screen, rather
              // than being unmounted/remounted every time `media` clears — so its
              // search/filter state survives navigating into a show and back via
              // the "Anime Vocab" breadcrumb (backToSearch below).
              <div style={{ display: media ? 'none' : undefined }}>
                <MediaSearch onSelected={handleMediaSelected} onLoadingChange={media ? undefined : setChildLoading} />
              </div>
            )}
            {media && !episode && <EpisodeList media={media} episodes={episodes} onSelectEpisode={setEpisode} />}
            {media && episode && !drillWords && (
              <EpisodeVocabBrowser media={media} episode={episode} onStartDrill={setDrillWords} onLoadingChange={setChildLoading} />
            )}
            {media && episode && drillWords && (
              <EpisodeDrill
                words={drillWords}
                onBack={backToBrowser}
                ttsVoice={settings.backupVoice}
                playOnFront={settings.frontAudio}
                playOnBack={settings.backAudio}
                sfxEnabled={settings.sfx}
                disableKeyboard={showOptions}
                showStreak={settings.streak}
                showFurigana={settings.furigana}
                showTranslation={settings.translation}
                showSentence={settings.sentence}
                showKanjiMeaning={settings.kanjiMeanings}
                pixelFont={settings.pixelFont}
                showVisualEffects={settings.visualEffects}
              />
            )}
          </div>
          {showFooter && <AttributionFooter sources={footerSources} />}
        </div>
        {showDrillSettings && (
          <SettingsSidebar
            open={showOptions}
            onToggle={() => setShowOptions(v => !v)}
            onClose={() => setShowOptions(false)}
            isMobile={isMobile}
          >
            {paddingH => renderSettingsPanel(paddingH)}
          </SettingsSidebar>
        )}
      </div>
    </div>
    </ModuleThemeProvider>
  )
}
