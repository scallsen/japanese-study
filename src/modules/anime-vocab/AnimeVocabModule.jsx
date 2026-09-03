import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import TopProgressBar from '../../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import SectionHeader from '../../components/SectionHeader.jsx'
import Checkbox from '../../components/Checkbox.jsx'
import Select from '../../components/Select.jsx'
import SettingsSidebar, { SidebarHeaderToggle } from '../../components/SettingsSidebar.jsx'
import MediaSearch from './MediaSearch.jsx'
import EpisodeList from './EpisodeList.jsx'
import EpisodeVocabBrowser from './EpisodeVocabBrowser.jsx'
import EpisodeDrill from './EpisodeDrill.jsx'
import TrackedAnimeSection from './TrackedAnimeSection.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { useJaVoices } from '../../hooks/useTTS.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { SENTENCE_SOURCE_OPTIONS, DEFAULT_SENTENCE_SOURCE } from '../../data/sentenceSource.js'
import { FONT, TRACKING, FS_BASE } from '../../data/theme.js'
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
  const [showStreak,       setShowStreak]       = useState(() => {
    const s = safeLocalStorageGet('vocab-show-streak'); return s === null ? true : s === 'true'
  })
  const [showFurigana,     setShowFurigana]     = useState(() => {
    const s = safeLocalStorageGet('vocab-show-furigana'); return s === null ? true : s === 'true'
  })
  const [showVisualEffects, setShowVisualEffects] = useState(() => {
    const s = safeLocalStorageGet('vocab-visual-effects'); return s === null ? true : s === 'true'
  })
  const [pixelFont,        setPixelFont]        = useState(() => {
    const s = safeLocalStorageGet('vocab-pixel-font'); return s === null ? true : s === 'true'
  })
  const [showTranslation,  setShowTranslation]  = useState(() => {
    const s = safeLocalStorageGet('vocab-show-translation'); return s === null ? true : s === 'true'
  })
  const [showSentence,     setShowSentence]     = useState(() => {
    const s = safeLocalStorageGet('vocab-show-sentence'); return s === null ? false : s === 'true'
  })
  const [sentenceSource, setSentenceSource] = useState(() => safeLocalStorageGet('vocab-sentence-source') ?? DEFAULT_SENTENCE_SOURCE)
  const [showKanjiMeaning, setShowKanjiMeaning] = useState(() => {
    const s = safeLocalStorageGet('vocab-show-kanji-meaning'); return s === null ? false : s === 'true'
  })
  const [audioEnabled,     setAudioEnabled]     = useState(() => {
    const s = safeLocalStorageGet('vocab-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [sfxEnabled,       setSfxEnabled]       = useState(() => {
    const s = safeLocalStorageGet('vocab-sfx-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsVoice,         setTtsVoice]         = useState(() => safeLocalStorageGet('vocab-tts-voice') ?? '')

  useEffect(() => { safeLocalStorageSet('vocab-show-streak',       showStreak) },        [showStreak])
  useEffect(() => { safeLocalStorageSet('vocab-show-furigana',     showFurigana) },       [showFurigana])
  useEffect(() => { safeLocalStorageSet('vocab-visual-effects',    showVisualEffects) },  [showVisualEffects])
  useEffect(() => { safeLocalStorageSet('vocab-pixel-font',        pixelFont) },          [pixelFont])
  useEffect(() => { safeLocalStorageSet('vocab-show-translation',  showTranslation) },    [showTranslation])
  useEffect(() => { safeLocalStorageSet('vocab-show-sentence',     showSentence) },       [showSentence])
  useEffect(() => { safeLocalStorageSet('vocab-sentence-source',   sentenceSource) },     [sentenceSource])
  useEffect(() => { safeLocalStorageSet('vocab-show-kanji-meaning', showKanjiMeaning) },  [showKanjiMeaning])
  useEffect(() => { safeLocalStorageSet('vocab-audio-enabled',     audioEnabled) },       [audioEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-sfx-enabled',       sfxEnabled) },         [sfxEnabled])
  useEffect(() => { safeLocalStorageSet('vocab-tts-voice',         ttsVoice) },           [ttsVoice])

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

  // No "Text to speech" (Voicevox) source picker like VocabPage's — Anime
  // Vocab words are drawn from episode vocabulary, never Voicevox-pre-
  // generated, so that control would always silently do nothing. Just the
  // browser-voice picker (vocab-tts-voice) is exposed here, under the same
  // "Enable audio" checkbox VocabPage uses.
  function renderSettingsPanel(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>
        <SectionHeader title="Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Checkbox checked={showStreak}        onChange={() => setShowStreak(v => !v)}        label="Show streak" />
          <Checkbox checked={showFurigana}      onChange={() => setShowFurigana(v => !v)}      label="Show furigana" />
          <Checkbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <Checkbox checked={pixelFont}         onChange={() => setPixelFont(v => !v)}         label="Use pixel font" />
          <Checkbox checked={showTranslation}   onChange={() => setShowTranslation(v => !v)}   label="Show translation" />
          <Checkbox checked={showSentence}      onChange={() => setShowSentence(v => !v)}       label="Show sentence" />
          {showSentence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
              <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Sentence source</span>
              <Select
                value={sentenceSource}
                onChange={setSentenceSource}
                options={SENTENCE_SOURCE_OPTIONS}
                label="Sentence source"
              />
            </div>
          )}
          <Checkbox checked={showKanjiMeaning}  onChange={() => setShowKanjiMeaning(v => !v)}   label="Show kanji meaning" />
          <Checkbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              {jaVoices.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                  <Select
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                </div>
              )}
              <Checkbox
                checked={sfxEnabled}
                onChange={() => setSfxEnabled(v => !v)}
                label="Sound effects"
                subtext="Silent mode may mute sound effects"
                indent={1}
              />
            </>
          )}
        </div>
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
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: showDrillBar ? '32px 24px 84px' : '32px 24px', display: 'flex', flexDirection: 'column' }}>
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
                ttsVoice={ttsVoice}
                audioEnabled={audioEnabled}
                sfxEnabled={sfxEnabled}
                disableKeyboard={showOptions}
                showStreak={showStreak}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                showSentence={showSentence}
                sentenceSource={sentenceSource}
                showKanjiMeaning={showKanjiMeaning}
                pixelFont={pixelFont}
                showVisualEffects={showVisualEffects}
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
