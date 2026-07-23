import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { getDeckStats, getGlobalStats, getCardStateCounts, getTodaysQueue, resolveCard, resetCardProgress, State } from './srs.js'
import { parseAnkiExport } from './import.js'
import { initSession } from './session.js'
import { migrateProgress, initializeDeckCards } from './migrate.js'
import VocabSrsDrill from './VocabSrsDrill.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import SpeakerIcon from '../../components/SpeakerIcon.jsx'
import HeaderMenu from '../../components/HeaderMenu.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_NAV, SUBHEADING_STYLE, FS_CAPTION, FS_CONTENT_HEADING } from '../../data/theme.js'
import DrawerSectionHeader from '../../components/DrawerSectionHeader.jsx'
import DrawerCheckbox from '../../components/DrawerCheckbox.jsx'
import DrawerSelect from '../../components/DrawerSelect.jsx'
import { useJaVoices } from '../../hooks/useTTS.js'
import { useAudioGenerationStatus } from '../../hooks/useAudioGenerationStatus.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { AUDIO_SOURCE_OPTIONS, DEFAULT_AUDIO_SOURCE, getVoicevoxCredit } from '../../utils/voicevoxAudio.js'

const ACCENT = '#3ABDA4'
const PANEL_W = 420
const CHEVRON_W = 28
const PANEL_CONTENT_W = PANEL_W - CHEVRON_W

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function StatRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0' }}>
      <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{label}</span>
      <span style={{ fontSize: FS_BASE, color: accent || TEXT, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function FileInput({ onChange, accept = '.txt', label = 'Choose .txt file' }) {
  return (
    <label style={{ cursor: 'pointer' }}>
      <div style={{
        display: 'inline-block',
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        fontSize: FS_BASE,
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}>
        {label}
      </div>
      <input type="file" accept={accept} style={{ display: 'none' }} onChange={onChange} />
    </label>
  )
}

function DeckRow({ deck, stats, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const notStarted = stats.total === 0
  const infoText = notStarted
    ? 'not started'
    : `${stats.total} cards · ${stats.dueToday} due · ${stats.newAvailable} new`

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: deck.active ? ACCENT : 'rgba(255,255,255,0.2)' }}>
            {deck.active ? '●' : '○'}
          </span>
          <span style={{ fontSize: FS_BASE, color: TEXT }}>{deck.name}</span>
        </div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{infoText}</div>
      </div>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flexShrink: 0,
          padding: '4px 10px',
          fontSize: FS_BASE,
          fontFamily: 'inherit',
          letterSpacing: TRACKING,
          background: deck.active
            ? hovered ? 'rgba(58,189,164,0.2)' : 'rgba(58,189,164,0.12)'
            : hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          color: deck.active ? ACCENT : TEXT_MUTED,
          border: `1px solid ${deck.active ? 'rgba(58,189,164,0.35)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 5,
          cursor: 'pointer',
          transition: 'background 130ms',
        }}
      >
        {deck.active ? 'On' : 'Off'}
      </button>
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
  const { user, signIn, signOut, loading: authLoading } = useAuth()
  const { data: rawProgress, save, loading } = useProgress('vocab-srs')
  const [progress, setProgress] = useState(null)
  const [session, setSession] = useState(null)
  const [sessionCards, setSessionCards] = useState([])
  // Tracks the new cards pulled into the active session so the daily new-card
  // count reflects cards actually introduced (answered out of State.New), not
  // cards merely queued. Bumping the count at session start let an abandoned
  // session consume the day's new-card allowance without any card being studied.
  const sessionNewCardsRef = useRef(null)
  const [importMsg, setImportMsg] = useState(null)
  const [ankiSyncMsg, setAnkiSyncMsg] = useState(null)
  const [advanceDays, setAdvanceDays] = useState(3)
  const [showOptions, setShowOptions] = useState(() => window.innerWidth > 768)
  const [chevronHovered, setChevronHovered] = useState(false)
  const [startHovered, setStartHovered] = useState(false)
  const [optionsHovered, setOptionsHovered] = useState(false)

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

  const isMobile = useIsMobile()
  const jaVoices = useJaVoices()
  const { isProcessing: audioProcessing } = useAudioGenerationStatus()

  if (loading && !progress) return null

  if (!user) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT }}>
        <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS' }]} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: FS_BASE, color: TEXT }}>Sign in to use Vocab SRS</div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 8 }}>Progress syncs to your account across devices</div>
          <button
            onClick={signIn}
            style={{ padding: '10px 24px', background: ACCENT, border: 'none', borderRadius: 8, color: '#fff', fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING, cursor: 'pointer' }}
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    )
  }

  if (!progress) return null

  const decks = progress.decks ?? {}
  const cardsObj = progress.cards ?? {}
  const deckList = Object.values(decks).sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))
  const globalStats = getGlobalStats(cardsObj, decks)
  const cardStateCounts = getCardStateCounts(cardsObj, decks)
  const todayStr = new Date().toISOString().split('T')[0]
  const newCardDay = progress.newCardDay ?? { date: '', count: 0 }
  const newCardsIntroducedToday = newCardDay.date === todayStr ? newCardDay.count : 0
  const effectiveNewPerDay = Math.max(0, dailyNewCards - newCardsIntroducedToday)
  const { due, newCards, rescheduled } = getTodaysQueue(cardsObj, decks, { newPerDay: effectiveNewPerDay })
  const canStart = due.length > 0 || newCards.length > 0 || rescheduled.length > 0
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

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const existingIds = Object.keys(cardsObj)
    const imported = parseAnkiExport(text, existingIds)

    if (imported.length === 0) {
      setImportMsg('No new cards found')
      e.target.value = ''
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
    e.target.value = ''
  }

  async function handleAnkiSyncFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    let syncCards
    try {
      syncCards = JSON.parse(await file.text())
    } catch {
      setAnkiSyncMsg('Invalid JSON file')
      e.target.value = ''
      return
    }

    if (typeof syncCards !== 'object' || Array.isArray(syncCards)) {
      setAnkiSyncMsg('Expected a JSON object')
      e.target.value = ''
      return
    }

    // Ensure all core2000 cards exist as New before overwriting reviewed ones
    let newProgress = progress
    const hasCore2000Cards = Object.values(cardsObj).some(c => c.deckId === 'core2000')
    if (!hasCore2000Cards) {
      newProgress = initializeDeckCards(newProgress, 'core2000')
    }

    const newCardsObj = { ...newProgress.cards }
    let count = 0
    for (const [id, cardState] of Object.entries(syncCards)) {
      if (typeof cardState !== 'object' || !cardState.id || !cardState.deckId) continue
      newCardsObj[id] = cardState
      count++
    }

    const merged = { ...newProgress, cards: newCardsObj }
    setProgress(merged)
    await save(merged)
    setAnkiSyncMsg(`${count} card${count === 1 ? '' : 's'} synced`)
    e.target.value = ''
  }

  function handleSidebarFocus(e) {
    const container = e.currentTarget
    const target = e.target
    const cRect = container.getBoundingClientRect()
    const tRect = target.getBoundingClientRect()
    if (tRect.top < cRect.top + 8) container.scrollTop += tRect.top - cRect.top - 8
    else if (tRect.bottom > cRect.bottom - 8) container.scrollTop += tRect.bottom - cRect.bottom + 8
  }

  function renderPanelContent(paddingH) {
    const hairline = { height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>

        {/* ── Deck Stats (global) ── */}
        <DrawerSectionHeader title="Deck Stats" />
        {globalStats.totalCards === 0 ? (
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, padding: '4px 0 8px' }}>
            No cards yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cardStateCounts.unlearned > 0 && <StatRow label="Unlearned" value={cardStateCounts.unlearned} />}
            {cardStateCounts.learning > 0 && <StatRow label="Learning" value={cardStateCounts.learning} />}
            {cardStateCounts.graduated > 0 && <StatRow label="Graduated" value={cardStateCounts.graduated} />}
            {cardStateCounts.relearning > 0 && <StatRow label="Relearning" value={cardStateCounts.relearning} />}
          </div>
        )}

        <div style={hairline} />

        {/* ── Decks ── */}
        <DrawerSectionHeader title="Decks" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {deckList.map(deck => (
            <DeckRow
              key={deck.id}
              deck={deck}
              stats={getDeckStats(cardsObj, deck.id)}
              onToggle={() => handleToggleDeck(deck.id)}
            />
          ))}
        </div>

        <div style={hairline} />

        {/* ── SRS Settings ── */}
        <DrawerSectionHeader title="SRS Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Daily new cards</span>
            <input
              type="number"
              value={dailyNewCards}
              min={1}
              onChange={e => setDailyNewCards(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 60,
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: TEXT,
                fontFamily: 'inherit',
                fontSize: FS_BASE,
                letterSpacing: TRACKING,
                textAlign: 'center',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>
              Leech threshold
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 6 }}>lapses (0 = off)</span>
            </span>
            <input
              type="number"
              value={leechThreshold}
              min={0}
              onChange={e => setLeechThreshold(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: 60,
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: TEXT,
                fontFamily: 'inherit',
                fontSize: FS_BASE,
                letterSpacing: TRACKING,
                textAlign: 'center',
              }}
            />
          </div>
          <DrawerCheckbox
            checked={showHardEasy}
            onChange={() => setShowHardEasy(v => !v)}
            label="Show Hard / Easy buttons"
          />
        </div>

        <div style={hairline} />

        {/* ── Additional Settings ── */}
        <DrawerSectionHeader title="Additional Settings" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DrawerCheckbox checked={showVisualEffects} onChange={() => setShowVisualEffects(v => !v)} label="Show visual effects" />
          <DrawerCheckbox checked={pixelFont} onChange={() => setPixelFont(v => !v)} label="Use pixel font" />
          <DrawerCheckbox checked={showTranslation} onChange={() => setShowTranslation(v => !v)} label="Show translation" />
          <DrawerCheckbox checked={showFurigana} onChange={() => setShowFurigana(v => !v)} label="Show furigana on front" />
          <DrawerCheckbox checked={showSentence} onChange={() => setShowSentence(v => !v)} label="Show sentence" />
          <DrawerCheckbox checked={showKanjiMeaning} onChange={() => setShowKanjiMeaning(v => !v)} label="Show kanji meaning" />
          <DrawerCheckbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <DrawerCheckbox
                checked={autoplayAudio}
                onChange={() => setAutoplayAudio(v => !v)}
                label="Auto-play"
                indent={1}
              />
              {autoplayAudio && (
                <>
                  <DrawerCheckbox
                    checked={autoplayFront}
                    onChange={() => setAutoplayFront(v => !v)}
                    label="On front"
                    indent={2}
                  />
                  <DrawerCheckbox
                    checked={autoplayBack}
                    onChange={() => setAutoplayBack(v => !v)}
                    label="On back (word then sentence)"
                    indent={2}
                  />
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                <span style={{ fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Text to speech</span>
                <DrawerSelect
                  value={audioSource}
                  onChange={setAudioSource}
                  options={AUDIO_SOURCE_OPTIONS}
                  label="Text to speech"
                />
                {getVoicevoxCredit(audioSource) && (
                  <span style={{ fontSize: FS_CAPTION, color: 'rgba(255,255,255,0.35)' }}>{getVoicevoxCredit(audioSource)}</span>
                )}
                {audioProcessing && (
                  <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>Audio is being generated</span>
                )}
                {audioSource === 'browser' && jaVoices.length > 0 && (
                  <DrawerSelect
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </div>
              <DrawerCheckbox
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
            <DrawerSectionHeader title="Dev" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Advance</span>
              <input
                type="number"
                value={advanceDays}
                min={1}
                onChange={e => setAdvanceDays(Number(e.target.value))}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: TEXT,
                  fontFamily: 'inherit',
                  fontSize: FS_BASE,
                  letterSpacing: TRACKING,
                }}
              />
              <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>days</span>
              <button
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
                style={{
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: TEXT,
                  fontFamily: 'inherit',
                  fontSize: FS_BASE,
                  cursor: 'pointer',
                  letterSpacing: TRACKING,
                }}
              >
                Apply
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
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
                style={{
                  padding: '4px 12px',
                  background: 'rgba(192,57,43,0.15)',
                  border: '1px solid rgba(192,57,43,0.4)',
                  borderRadius: 4,
                  color: '#f87171',
                  fontFamily: 'inherit',
                  fontSize: FS_BASE,
                  cursor: 'pointer',
                  letterSpacing: TRACKING,
                }}
              >
                Reset active decks
              </button>
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
              rightSlot={<HeaderMenu
                primary={
                  <button
                    onClick={() => setShowOptions(v => !v)}
                    onMouseEnter={() => setOptionsHovered(true)}
                    onMouseLeave={() => setOptionsHovered(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 34, padding: '0 12px', fontSize: FS_BASE,
                      fontFamily: 'inherit',
                      background: optionsHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 8, cursor: 'pointer',
                      transition: 'background 130ms',
                    }}
                  >
                    Options
                  </button>
                }
                items={[
                  {
                    label: audioEnabled ? 'Mute' : 'Unmute',
                    icon: <SpeakerIcon muted={!audioEnabled} size={20} />,
                    onClick: () => setAudioEnabled(v => !v),
                    dim: !audioEnabled,
                  },
                  ...(!authLoading ? [{
                    label: user ? 'Sign out' : 'Sign in',
                    onClick: user ? signOut : signIn,
                  }] : []),
                ]}
              />}
            />

            <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
              <div style={{ maxWidth: 480, margin: '0 auto' }}>

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
                      <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, letterSpacing: TRACKING, marginBottom: 6 }}>
                        {canStart
                          ? `${due.length + rescheduled.length} due · ${newCards.length} new · ~${Math.ceil((due.length + rescheduled.length + newCards.length) * 0.25) || '<1'} min`
                          : 'Nothing due'}
                      </div>
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

                    <button
                      onClick={canStart ? () => handleStartReview(effectiveNewPerDay) : undefined}
                      onMouseEnter={() => setStartHovered(true)}
                      onMouseLeave={() => setStartHovered(false)}
                      disabled={!canStart}
                      style={{
                        width: '100%',
                        height: 44,
                        fontSize: FS_BASE,
                        fontFamily: 'inherit',
                        letterSpacing: TRACKING,
                        background: canStart
                          ? startHovered ? 'rgba(58,189,164,0.25)' : 'rgba(58,189,164,0.15)'
                          : 'rgba(255,255,255,0.04)',
                        color: canStart ? ACCENT : TEXT_MUTED,
                        border: `1px solid ${canStart ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 8,
                        cursor: canStart ? 'pointer' : 'default',
                        transition: 'background 130ms',
                        marginBottom: 28,
                      }}
                    >
                      {canStart ? `Start review (${due.length + rescheduled.length + newCards.length})` : 'Nothing due'}
                    </button>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
                      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, marginBottom: 10 }}>
                        Import
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <FileInput onChange={handleFileChange} />
                          {importMsg && (
                            <span style={{ fontSize: FS_BASE, color: '#4ade80' }}>{importMsg}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <FileInput
                            accept=".json"
                            label="Sync from Anki (.json)"
                            onChange={handleAnkiSyncFileChange}
                          />
                          {ankiSyncMsg && (
                            <span style={{ fontSize: FS_BASE, color: '#4ade80' }}>{ankiSyncMsg}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                        {Object.keys(cardsObj).length} total cards
                      </div>
                    </div>
                  </>
                )}

              </div>
            </main>
          </div>
        )}
      </div>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <>
          <div
            onClick={() => setShowOptions(v => !v)}
            onMouseEnter={() => setChevronHovered(true)}
            onMouseLeave={() => setChevronHovered(false)}
            style={{
              flexShrink: 0,
              width: CHEVRON_W,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: showOptions ? '1px solid rgba(255,255,255,0.1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: chevronHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition: 'background 130ms',
            }}
          >
            <button style={{
              width: CHEVRON_W, height: 44,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', padding: 0,
            }}>
              {showOptions ? '›' : '‹'}
            </button>
          </div>
          <div style={{
            flexShrink: 0,
            width: showOptions ? PANEL_CONTENT_W : 0,
            overflow: 'hidden',
            transition: 'width 220ms ease',
          }}>
            <div className="sidebar-scroll" style={{ width: PANEL_CONTENT_W, height: '100%', overflowY: 'auto' }} onFocus={handleSidebarFocus}>
              {renderPanelContent(16)}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile overlay ── */}
      {isMobile && showOptions && (
        <>
          <div onClick={() => setShowOptions(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20 }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 30, background: '#2E2E2E',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ color: '#fff', fontSize: FS_BASE, fontWeight: 700 }}>Options</div>
              <button
                onClick={() => setShowOptions(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: FS_BASE, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                Back
              </button>
            </div>
            <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }} onFocus={handleSidebarFocus}>
              {renderPanelContent(20)}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
