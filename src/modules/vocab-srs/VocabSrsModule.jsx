import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { getDeckStats, getGlobalStats, getStateDistribution, tallyCardStates, getTodaysQueue, resolveCard, resetCardProgress, createCard, State } from './srs.js'
import { parseAnkiExport } from './import.js'
import { initSession } from './session.js'
import { migrateProgress, initializeDeckCards } from './migrate.js'
import VocabSrsDrill from './VocabSrsDrill.jsx'
import WordImportPanel from './WordImportPanel.jsx'
import { ensureDeck, createDeck, renameDeck, deleteCards } from './deckUtils.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import SettingsSidebar, { SidebarHeaderToggle } from '../../components/SettingsSidebar.jsx'
import SignInGate from '../../components/SignInGate.jsx'
import Button from '../../components/Button.jsx'
import FileButton from '../../components/FileButton.jsx'
import NumberField from '../../components/NumberField.jsx'
import ToggleButton from '../../components/ToggleButton.jsx'
import Badge from '../../components/Badge.jsx'
import DistributionBar from '../../components/DistributionBar.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_NAV, SUBHEADING_STYLE, FS_CAPTION, FS_CONTENT_HEADING, SUCCESS } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../../context/ModuleThemeContext.jsx'
import { STATE_SEGMENTS, SUSPENDED_DESCRIPTION } from './cardStates.js'
import SectionHeader from '../../components/SectionHeader.jsx'
import Checkbox from '../../components/Checkbox.jsx'
import Select from '../../components/Select.jsx'
import { useJaVoices } from '../../hooks/useTTS.js'
import { useAudioGenerationStatus } from '../../hooks/useAudioGenerationStatus.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { AUDIO_SOURCE_OPTIONS, DEFAULT_AUDIO_SOURCE, getVoicevoxCredit, speakerIdFromAudioSource } from '../../utils/voicevoxAudio.js'
import { SENTENCE_SOURCE_OPTIONS, DEFAULT_SENTENCE_SOURCE } from '../../data/sentenceSource.js'
import AttributionFooter from '../../components/AttributionFooter.jsx'
import { renderAttributionSegments } from '../../utils/attributionSegments.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const SRS_ACCENT = MODULES.find(m => m.id === 'vocab-srs').accent

// DistributionBar owns the bar + legend; the suspended count sits outside the
// ramp (it's a status, not a learning stage) so it's a danger Badge below.
function DeckProgressBar({ distribution }) {
  if (distribution.total === 0) return null
  // Pre-filtered so the legend only lists states that are present, as before.
  const segments = STATE_SEGMENTS.map(seg => ({ ...seg, count: distribution[seg.key] })).filter(seg => seg.count > 0)
  return (
    <div>
      <DistributionBar segments={segments} />
      {distribution.suspended > 0 && (
        <div title={SUSPENDED_DESCRIPTION} style={{ display: 'inline-flex', marginTop: 10, cursor: 'help' }}>
          <Badge tone="danger">⚠ {distribution.suspended} suspended</Badge>
        </div>
      )}
    </div>
  )
}

function DeckRow({ deck, stats, onToggle, onRename }) {
  const ACCENT = useAccent()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(deck.name)
  const canManage = deck.source === 'imported'
  const notStarted = stats.total === 0
  const infoText = notStarted
    ? 'not started'
    : `${stats.total} cards · ${stats.dueToday} due · ${stats.newAvailable} new`

  function commitRename() {
    setEditing(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== deck.name) onRename(trimmed)
    else setDraftName(deck.name)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: deck.active ? ACCENT : 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
              {deck.active ? '●' : '○'}
            </span>
            {editing ? (
              <input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setDraftName(deck.name); setEditing(false) }
                }}
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: FS_BASE,
                  color: TEXT,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontFamily: 'inherit',
                  letterSpacing: TRACKING,
                }}
              />
            ) : (
              <span
                onClick={canManage ? () => setEditing(true) : undefined}
                title={canManage ? 'Click to rename' : undefined}
                style={{ fontSize: FS_BASE, color: TEXT, cursor: canManage ? 'text' : 'default' }}
              >
                {deck.name}
              </span>
            )}
          </div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{infoText}</div>
        </div>
        <ToggleButton active={deck.active} labels={{ on: 'On', off: 'Off' }} onClick={onToggle} />
      </div>
      {canManage && (
        <a
          href={`#/vocab-srs/browse?deck=${deck.id}&manage=1`}
          className="srs-browse-link"
          style={{ fontSize: FS_CAPTION, color: ACCENT }}
        >
          Manage cards →
        </a>
      )}
    </div>
  )
}

// Converts a resolved card array (from drill) back to the cards{} object format,
// stripping front/back for bundled decks since their content lives in static JSON.
function resolvedArrayToCardsObj(resolvedCards, decks) {
  const obj = {}
  for (const card of resolvedCards) {
    const deck = decks[card.deckId]
    if (deck?.source === 'bundled') {
      // eslint-disable-next-line no-unused-vars
      const { front: _f, back: _b, ...cardState } = card
      obj[card.id] = cardState
    } else {
      obj[card.id] = card
    }
  }
  return obj
}

export default function VocabSrsModule() {
  return (
    <ModuleThemeProvider accent={SRS_ACCENT}>
      <VocabSrsHome />
    </ModuleThemeProvider>
  )
}

function VocabSrsHome() {
  const ACCENT = useAccent()
  const { user, signIn } = useAuth()
  const { data: rawProgress, save, loading } = useProgress('vocab-srs')
  const { showToast } = useToast()
  const [progress, setProgress] = useState(null)
  const [session, setSession] = useState(null)
  const [sessionCards, setSessionCards] = useState([])
  // Tracks the new cards pulled into the active session so the daily new-card
  // count reflects cards actually introduced (answered out of State.New), not
  // cards merely queued. Bumping the count at session start let an abandoned
  // session consume the day's new-card allowance without any card being studied.
  const sessionNewCardsRef = useRef(null)
  const [importMsg, setImportMsg] = useState(null)
  const [showWordImport, setShowWordImport] = useState(false)
  const [advanceDays, setAdvanceDays] = useState(3)
  const [showOptions, setShowOptions] = useState(() => window.innerWidth > 768)

  const [showVisualEffects, setShowVisualEffects] = useState(() => {
    const s = safeLocalStorageGet('srs-visual-effects'); return s === null ? true : s === 'true'
  })
  const [pixelFont, setPixelFont] = useState(() => {
    const s = safeLocalStorageGet('srs-pixel-font'); return s === null ? true : s === 'true'
  })
  const [showTranslation, setShowTranslation] = useState(() => {
    const s = safeLocalStorageGet('srs-show-translation'); return s === null ? true : s === 'true'
  })
  const [showFurigana, setShowFurigana] = useState(() => {
    const s = safeLocalStorageGet('srs-show-furigana'); return s === null ? true : s === 'true'
  })
  const [showSentence, setShowSentence] = useState(() => {
    const s = safeLocalStorageGet('srs-show-sentence'); return s === null ? true : s === 'true'
  })
  const [sentenceSource, setSentenceSource] = useState(() => safeLocalStorageGet('srs-sentence-source') ?? DEFAULT_SENTENCE_SOURCE)
  const [showKanjiMeaning, setShowKanjiMeaning] = useState(() => {
    const s = safeLocalStorageGet('srs-show-kanji-meaning'); return s === null ? false : s === 'true'
  })
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const s = safeLocalStorageGet('srs-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [autoplayAudio, setAutoplayAudio] = useState(() => {
    const s = safeLocalStorageGet('srs-autoplay-audio'); return s === null ? true : s === 'true'
  })
  const [autoplayFront, setAutoplayFront] = useState(() => {
    const s = safeLocalStorageGet('srs-autoplay-front'); return s === null ? true : s === 'true'
  })
  const [autoplayBack, setAutoplayBack] = useState(() => {
    const s = safeLocalStorageGet('srs-autoplay-back'); return s === null ? true : s === 'true'
  })
  const [audioSource, setAudioSource] = useState(() => safeLocalStorageGet('srs-audio-source') ?? DEFAULT_AUDIO_SOURCE)
  const [sfxEnabled, setSfxEnabled] = useState(() => {
    const s = safeLocalStorageGet('srs-sfx-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsVoice, setTtsVoice] = useState(() => safeLocalStorageGet('srs-tts-voice') ?? '')
  const [dailyNewCards, setDailyNewCards] = useState(() => {
    const s = safeLocalStorageGet('srs-daily-new-cards'); return s ? parseInt(s, 10) : 10
  })
  const [showHardEasy, setShowHardEasy] = useState(() => {
    const s = safeLocalStorageGet('srs-show-hard-easy'); return s === null ? true : s === 'true'
  })
  const [leechThreshold, setLeechThreshold] = useState(() => {
    const s = safeLocalStorageGet('srs-leech-threshold'); return s ? parseInt(s, 10) : 8
  })

  useEffect(() => { safeLocalStorageSet('srs-visual-effects', showVisualEffects) }, [showVisualEffects])
  useEffect(() => { safeLocalStorageSet('srs-pixel-font', pixelFont) }, [pixelFont])
  useEffect(() => { safeLocalStorageSet('srs-show-translation', showTranslation) }, [showTranslation])
  useEffect(() => { safeLocalStorageSet('srs-show-furigana', showFurigana) }, [showFurigana])
  useEffect(() => { safeLocalStorageSet('srs-show-sentence', showSentence) }, [showSentence])
  useEffect(() => { safeLocalStorageSet('srs-sentence-source', sentenceSource) }, [sentenceSource])
  useEffect(() => { safeLocalStorageSet('srs-show-kanji-meaning', showKanjiMeaning) }, [showKanjiMeaning])
  useEffect(() => { safeLocalStorageSet('srs-audio-enabled', audioEnabled) }, [audioEnabled])
  useEffect(() => { safeLocalStorageSet('srs-autoplay-audio', autoplayAudio) }, [autoplayAudio])
  useEffect(() => { safeLocalStorageSet('srs-autoplay-front', autoplayFront) }, [autoplayFront])
  useEffect(() => { safeLocalStorageSet('srs-autoplay-back', autoplayBack) }, [autoplayBack])
  useEffect(() => { safeLocalStorageSet('srs-audio-source', audioSource) }, [audioSource])
  useEffect(() => { safeLocalStorageSet('srs-sfx-enabled', sfxEnabled) }, [sfxEnabled])
  useEffect(() => { safeLocalStorageSet('srs-tts-voice', ttsVoice) }, [ttsVoice])
  useEffect(() => { safeLocalStorageSet('srs-daily-new-cards', dailyNewCards) }, [dailyNewCards])
  useEffect(() => { safeLocalStorageSet('srs-show-hard-easy', showHardEasy) }, [showHardEasy])
  useEffect(() => { safeLocalStorageSet('srs-leech-threshold', leechThreshold) }, [leechThreshold])

  // Apply migration and auto-initialize active bundled decks on first load.
  useEffect(() => {
    if (loading || !user) return

    let p = migrateProgress(rawProgress)
    let needsSave = !rawProgress?.decks || Array.isArray(rawProgress?.cards)

    for (const deck of Object.values(p.decks)) {
      if (deck.active && deck.source === 'bundled') {
        const hasCards = Object.values(p.cards).some(c => c.deckId === deck.id)
        if (!hasCards) {
          p = initializeDeckCards(p, deck.id)
          needsSave = true
        }
      }
    }

    setProgress(p)
    if (needsSave) save(p)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  // The dashboard's "Start reviews" deep-links here as `#/vocab-srs?start=1`.
  // Once progress is loaded, start the same session the home screen's button
  // would, then strip the query so returning to the home screen (or a
  // reload) doesn't restart it.
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (!progress || session || autoStartedRef.current) return
    const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    if (query.get('start') !== '1') return
    autoStartedRef.current = true
    window.history.replaceState(null, '', '#/vocab-srs')
    const today = new Date().toISOString().split('T')[0]
    const day = progress.newCardDay ?? { date: '', count: 0 }
    const newPerDay = Math.max(0, dailyNewCards - (day.date === today ? day.count : 0))
    const queue = getTodaysQueue(progress.cards ?? {}, progress.decks ?? {}, { newPerDay })
    if (queue.due.length > 0 || queue.newCards.length > 0 || queue.rescheduled.length > 0) handleStartReview(newPerDay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  const isMobile = useIsMobile()
  const jaVoices = useJaVoices()
  const { isProcessing: audioProcessing } = useAudioGenerationStatus()

  if (loading && !progress) return null

  if (!user) {
    return (
      <SignInGate
        crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS' }]}
        title="Sign in to use Vocab SRS"
        subtitle="Progress syncs to your account across devices"
        onSignIn={signIn}
      />
    )
  }

  if (!progress) return null

  const decks = progress.decks ?? {}
  const cardsObj = progress.cards ?? {}
  const deckList = Object.values(decks).sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))
  const globalStats = getGlobalStats(cardsObj, decks)
  const stateDistribution = getStateDistribution(cardsObj, decks)
  const todayStr = new Date().toISOString().split('T')[0]
  const newCardDay = progress.newCardDay ?? { date: '', count: 0 }
  const newCardsIntroducedToday = newCardDay.date === todayStr ? newCardDay.count : 0
  const effectiveNewPerDay = Math.max(0, dailyNewCards - newCardsIntroducedToday)
  const { due, newCards, rescheduled } = getTodaysQueue(cardsObj, decks, { newPerDay: effectiveNewPerDay })
  const canStart = due.length > 0 || newCards.length > 0 || rescheduled.length > 0
  // Distribution of the cards that would actually be studied if "Start review"
  // were pressed right now — distinct from stateDistribution's whole-deck view.
  const queueDistribution = tallyCardStates([...due, ...rescheduled, ...newCards])
  const activeDecks = deckList.filter(d => d.active)

  // Recomputes today's new-card count from cards actually introduced this
  // session — a session card that has left State.New has been studied. Returns
  // null when no session is tracked, so callers leave newCardDay untouched.
  function computeNewCardDay(cardsObject) {
    const tracker = sessionNewCardsRef.current
    if (!tracker) return null
    let introduced = 0
    for (const id of tracker.ids) {
      const card = cardsObject[id]
      if (card && card.state !== State.New) introduced++
    }
    return { date: todayStr, count: tracker.baseline + introduced }
  }

  function handleStartReview(newPerDay) {
    const { due: d, newCards: n, rescheduled } = getTodaysQueue(cardsObj, decks, { newPerDay })

    const baseline = newCardDay.date === todayStr ? newCardDay.count : 0
    sessionNewCardsRef.current = { ids: new Set(n.map(c => c.id)), baseline }

    let currentProgress = { ...progress }

    const allDue = [...d]
    if (rescheduled.length > 0) {
      const newCardsObj = { ...cardsObj }
      for (const card of rescheduled) newCardsObj[card.id] = card
      currentProgress = { ...currentProgress, cards: newCardsObj }
      allDue.push(...rescheduled)
    }

    setProgress(currentProgress)
    save(currentProgress)

    const resolvedDue = allDue.map(c => resolveCard(c))
    const resolvedNew = n.map(c => resolveCard(c))
    const allResolved = [...resolvedDue, ...resolvedNew]

    setSessionCards(allResolved)
    setSession(initSession(resolvedDue, resolvedNew))
  }

  function handleCardSave(updatedSessionCards) {
    const newCardsObj = { ...cardsObj, ...resolvedArrayToCardsObj(updatedSessionCards, decks) }
    const newProgress = { ...progress, cards: newCardsObj }
    const newCardDayUpdate = computeNewCardDay(newCardsObj)
    if (newCardDayUpdate) newProgress.newCardDay = newCardDayUpdate
    setProgress(newProgress)
    save(newProgress)
  }

  function handleDrillDone(updatedSessionCards, goodCount) {
    const newCardsObj = { ...cardsObj, ...resolvedArrayToCardsObj(updatedSessionCards, decks) }
    const newCardDayUpdate = computeNewCardDay(newCardsObj)
    const newProgress = {
      ...progress,
      cards: newCardsObj,
      lastSession: new Date().toISOString(),
      totalReviews: (progress.totalReviews ?? 0) + goodCount,
      ...(newCardDayUpdate ? { newCardDay: newCardDayUpdate } : {}),
    }
    sessionNewCardsRef.current = null
    setProgress(newProgress)
    save(newProgress)
    setSession(null)
    setSessionCards([])
  }

  function handleExitSession() {
    sessionNewCardsRef.current = null
    setSession(null)
  }

  function handleToggleDeck(deckId) {
    const deck = decks[deckId]
    const newActive = !deck.active

    let newProgress = {
      ...progress,
      decks: { ...decks, [deckId]: { ...deck, active: newActive } },
    }

    if (newActive && deck.source === 'bundled') {
      const hasCards = Object.values(cardsObj).some(c => c.deckId === deckId)
      if (!hasCards) {
        newProgress = initializeDeckCards(newProgress, deckId)
      }
    }

    setProgress(newProgress)
    save(newProgress)
  }

  async function handleFileChange(file) {
    const text = await file.text()
    const existingIds = Object.keys(cardsObj)
    const imported = parseAnkiExport(text, existingIds)

    if (imported.length === 0) {
      setImportMsg('No new cards found')
      return
    }

    const newCardsObj = { ...cardsObj }
    for (const card of imported) newCardsObj[card.id] = card

    const newDecks = { ...decks }
    if (!newDecks['imported']) {
      newDecks['imported'] = { id: 'imported', name: 'Imported', source: 'imported', active: true, addedAt: Date.now() }
    }

    const newProgress = { ...progress, decks: newDecks, cards: newCardsObj }
    setProgress(newProgress)
    await save(newProgress)
    setImportMsg(`${imported.length} card${imported.length === 1 ? '' : 's'} imported`)
  }

  function buildWordImportCards(words, deckId) {
    const ts = Date.now()
    const newCards = {}
    const newCardIds = []
    words.forEach((w, i) => {
      const extras = {}
      if (w.reading) extras.kana = w.reading
      if (w.jmdictId) extras.jmdictId = w.jmdictId
      const cardId = `word-import-${ts}-${i}`
      newCards[cardId] = createCard(w.surface, w.meaning, cardId, deckId, extras)
      newCardIds.push(cardId)
    })
    return { newCards, newCardIds }
  }

  function showWordImportAddedToast(cardIds, deckName) {
    showToast({
      message: `Added ${cardIds.length} word${cardIds.length === 1 ? '' : 's'} to "${deckName}".`,
      actionLabel: 'Undo',
      onAction: () => handleUndoWordImportAdd(cardIds),
    })
  }

  async function handleWordImportAdd(words, deckId) {
    const newDecks = ensureDeck(decks, deckId, decks[deckId]?.name ?? 'Deck')
    const { newCards, newCardIds } = buildWordImportCards(words, deckId)
    const newProgress = { ...progress, decks: newDecks, cards: { ...cardsObj, ...newCards } }
    setProgress(newProgress)
    await save(newProgress)
    showWordImportAddedToast(newCardIds, newDecks[deckId]?.name ?? 'Deck')
  }

  async function handleWordImportCreateAndAdd(words, name) {
    const { decks: newDecks, deckId } = createDeck(decks, name)
    const { newCards, newCardIds } = buildWordImportCards(words, deckId)
    const newProgress = { ...progress, decks: newDecks, cards: { ...cardsObj, ...newCards } }
    setProgress(newProgress)
    await save(newProgress)
    showWordImportAddedToast(newCardIds, name)
  }

  function handleUndoWordImportAdd(cardIds) {
    const newProgress = { ...progress, cards: deleteCards(cardsObj, cardIds) }
    setProgress(newProgress)
    save(newProgress)
  }

  function handleRenameDeck(deckId, newName) {
    const newDecks = renameDeck(decks, deckId, newName)
    const newProgress = { ...progress, decks: newDecks }
    setProgress(newProgress)
    save(newProgress)
  }

  function renderPanelContent(paddingH) {
    const hairline = { height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>

        {/* ── Deck Stats (global) ── */}
        <SectionHeader title="Deck Stats" />
        {stateDistribution.total === 0 ? (
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, padding: '4px 0 8px' }}>
            No cards yet
          </div>
        ) : (
          <>
            <DeckProgressBar distribution={stateDistribution} />
            <a href="#/vocab-srs/browse" className="srs-browse-link" style={{ display: 'inline-block', marginTop: 12, fontSize: FS_BASE, color: ACCENT }}>
              View all cards →
            </a>
          </>
        )}

        <div style={hairline} />

        {/* ── Decks ── */}
        <SectionHeader title="Decks" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {deckList.map(deck => (
            <DeckRow
              key={deck.id}
              deck={deck}
              stats={getDeckStats(cardsObj, deck.id)}
              onToggle={() => handleToggleDeck(deck.id)}
              onRename={newName => handleRenameDeck(deck.id, newName)}
            />
          ))}
        </div>

        <div style={hairline} />

        {/* ── SRS Settings ── */}
        <SectionHeader title="SRS Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Daily new cards</span>
            <NumberField value={dailyNewCards} min={1} onChange={v => setDailyNewCards(Math.max(1, parseInt(v) || 1))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>
              Leech threshold
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 6 }}>lapses (0 = off)</span>
            </span>
            <NumberField value={leechThreshold} min={0} onChange={v => setLeechThreshold(Math.max(0, parseInt(v) || 0))} />
          </div>
          <Checkbox
            checked={showHardEasy}
            onChange={() => setShowHardEasy(v => !v)}
            label="Show Hard / Easy buttons"
          />
        </div>

        <div style={hairline} />

        {/* ── Additional Settings ── */}
        <SectionHeader title="Additional Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Checkbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <Checkbox checked={pixelFont} onChange={() => setPixelFont(v => !v)} label="Use pixel font" />
          <Checkbox checked={showTranslation} onChange={() => setShowTranslation(v => !v)} label="Show translation" />
          <Checkbox checked={showFurigana} onChange={() => setShowFurigana(v => !v)} label="Show furigana on front" />
          <Checkbox checked={showSentence} onChange={() => setShowSentence(v => !v)} label="Show sentence" />
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
          <Checkbox checked={showKanjiMeaning} onChange={() => setShowKanjiMeaning(v => !v)} label="Show kanji meaning" />
          <Checkbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <Checkbox
                checked={autoplayAudio}
                onChange={() => setAutoplayAudio(v => !v)}
                label="Auto-play"
                indent={1}
              />
              {autoplayAudio && (
                <>
                  <Checkbox
                    checked={autoplayFront}
                    onChange={() => setAutoplayFront(v => !v)}
                    label="On front"
                    indent={2}
                  />
                  <Checkbox
                    checked={autoplayBack}
                    onChange={() => setAutoplayBack(v => !v)}
                    label="On back (word then sentence)"
                    indent={2}
                  />
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Text to speech</span>
                <Select
                  value={audioSource}
                  onChange={setAudioSource}
                  options={AUDIO_SOURCE_OPTIONS}
                  label="Text to speech"
                />
                {getVoicevoxCredit(audioSource) && (
                  <span style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)' }}>{renderAttributionSegments(getVoicevoxCredit(audioSource))}</span>
                )}
                {audioProcessing && (
                  <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Audio is being generated</span>
                )}
                {audioSource === 'browser' && jaVoices.length > 0 && (
                  <Select
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </div>
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

        {/* ── Dev (DEV only) ── */}
        {import.meta.env.DEV && globalStats.totalCards > 0 && (
          <>
            <div style={hairline} />
            <SectionHeader title="Dev" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Advance</span>
              <NumberField value={advanceDays} min={1} onChange={v => setAdvanceDays(Number(v))} />
              <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>days</span>
              <Button
                variant="neutral"
                size="sm"
                onClick={() => {
                  const ms = advanceDays * 24 * 60 * 60 * 1000
                  const newCardsObj = {}
                  for (const [id, card] of Object.entries(cardsObj)) {
                    newCardsObj[id] = { ...card, due: card.due ? new Date(new Date(card.due) - ms).toISOString() : card.due }
                  }
                  const newProgress = { ...progress, cards: newCardsObj, newCardDay: { date: '', count: 0 } }
                  setProgress(newProgress)
                  save(newProgress)
                }}
              >
                Apply
              </Button>
            </div>
            <div style={{ marginTop: 10 }}>
              <Button
                variant="danger-outline"
                size="sm"
                onClick={() => {
                  const activeDeckIds = new Set(
                    Object.values(decks).filter(d => d.active).map(d => d.id)
                  )
                  const newCardsObj = {}
                  for (const [id, card] of Object.entries(cardsObj)) {
                    newCardsObj[id] = activeDeckIds.has(card.deckId) ? resetCardProgress(card) : card
                  }
                  const newProgress = { ...progress, cards: newCardsObj, newCardDay: { date: '', count: 0 } }
                  setProgress(newProgress)
                  save(newProgress)
                }}
              >
                Reset active decks
              </Button>
            </div>
          </>
        )}

      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      position: 'relative',
      width: '100vw',
      height: '100dvh',
      background: '#1E1E1E',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      overflow: 'hidden',
    }}>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        {session ? (
          <VocabSrsDrill
            initialCards={sessionCards}
            initialSession={session}
            onCardSave={handleCardSave}
            onDone={handleDrillDone}
            showTranslation={showTranslation}
            showFurigana={showFurigana}
            showSentence={showSentence}
            sentenceSource={sentenceSource}
            showKanjiMeaning={showKanjiMeaning}
            pixelFont={pixelFont}
            showVisualEffects={showVisualEffects}
            audioEnabled={audioEnabled}
            autoplayFront={audioEnabled && autoplayAudio && autoplayFront}
            autoplayBack={audioEnabled && autoplayAudio && autoplayBack}
            audioSource={audioSource}
            sfxEnabled={audioEnabled && sfxEnabled}
            ttsVoice={ttsVoice}
            showHardEasy={showHardEasy}
            leechThreshold={leechThreshold}
            isMobile={isMobile}
            onShowOptions={() => setShowOptions(v => !v)}
            crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS', onClick: handleExitSession }]}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: TEXT }}>
            <PageHeader
              crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS' }]}
              rightSlot={(
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <AuthSlot />
                  {isMobile && <SidebarHeaderToggle onClick={() => setShowOptions(true)} />}
                </div>
              )}
            />

            <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>

                {activeDecks.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 60 }}>
                    <div style={{ fontSize: FS_NAV, color: TEXT, marginBottom: 8 }}>No active decks</div>
                    <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>
                      Enable a deck in the settings panel to begin
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Global summary */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, letterSpacing: TRACKING, marginBottom: 14 }}>
                        {canStart
                          ? `${due.length + rescheduled.length} due · ${newCards.length} new · ~${Math.ceil((due.length + rescheduled.length + newCards.length) * 0.25) || '<1'} min`
                          : 'Nothing due'}
                      </div>
                      <DeckProgressBar distribution={queueDistribution} />
                    </div>

                    {/* Per-deck breakdown */}
                    {activeDecks.length > 1 && (
                      <div style={{ marginBottom: 24 }}>
                        {activeDecks.map(deck => {
                          const ds = getDeckStats(cardsObj, deck.id)
                          return (
                            <div key={deck.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '5px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}>
                              <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{deck.name}</span>
                              <span style={{ fontSize: FS_BASE, color: TEXT }}>
                                {ds.dueToday} due · {ds.newAvailable} new
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ marginBottom: 28 }}>
                      <Button variant="accent-outline" size="lg" fullWidth onClick={() => handleStartReview(effectiveNewPerDay)} disabled={!canStart}>
                        {canStart ? `Start review (${due.length + rescheduled.length + newCards.length})` : 'Nothing due'}
                      </Button>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
                      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, marginBottom: 10 }}>
                        Import
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <FileButton accept=".txt" onFile={handleFileChange}>Choose .txt file</FileButton>
                          {importMsg && (
                            <span style={{ fontSize: FS_BASE, color: SUCCESS }}>{importMsg}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <Button variant="neutral" onClick={() => setShowWordImport(true)}>Import from text / image</Button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                        {Object.keys(cardsObj).length} total cards
                      </div>
                    </div>
                  </>
                )}
                </div>

                <AttributionFooter sources={[
                  'dictionary',
                  'tanaka-corpus',
                  ...(audioEnabled && speakerIdFromAudioSource(audioSource) ? ['voicevox'] : []),
                ]} />
              </div>
            </main>
          </div>
        )}
      </div>

      <SettingsSidebar
        open={showOptions}
        onToggle={() => setShowOptions(v => !v)}
        onClose={() => setShowOptions(false)}
        isMobile={isMobile}
      >
        {renderPanelContent}
      </SettingsSidebar>

      <WordImportPanel
        open={showWordImport}
        onClose={() => setShowWordImport(false)}
        decks={decks}
        isMobile={isMobile}
        onAdd={handleWordImportAdd}
        onCreateAndAdd={handleWordImportCreateAndAdd}
      />

    </div>
  )
}
