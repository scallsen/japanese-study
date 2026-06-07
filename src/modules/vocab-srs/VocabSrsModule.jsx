import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { getDeckStats, getGlobalStats, getCardStateCounts, getTodaysQueue, resolveCard, resetCardProgress } from './srs.js'
import { parseAnkiExport } from './import.js'
import { initSession } from './session.js'
import { migrateProgress, initializeDeckCards } from './migrate.js'
import VocabSrsDrill from './VocabSrsDrill.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, BORDER } from '../../data/theme.js'
import DrawerSectionHeader from '../../components/DrawerSectionHeader.jsx'
import DrawerCheckbox from '../../components/DrawerCheckbox.jsx'
import DrawerSelect from '../../components/DrawerSelect.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { useJaVoices } from '../../hooks/useTTS.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'

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
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>{label}</span>
      <span style={{ fontSize: 13, color: accent || TEXT, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function FileInput({ onChange }) {
  return (
    <label style={{ cursor: 'pointer' }}>
      <div style={{
        display: 'inline-block',
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}>
        Choose .txt file
      </div>
      <input type="file" accept=".txt" style={{ display: 'none' }} onChange={onChange} />
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
          <span style={{ fontSize: 13, color: TEXT }}>{deck.name}</span>
        </div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>{infoText}</div>
      </div>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flexShrink: 0,
          padding: '4px 10px',
          fontSize: 12,
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
  const { user, signIn } = useAuth()
  const { data: rawProgress, save, loading } = useProgress('vocab-srs')
  const [progress, setProgress] = useState(null)
  const [session, setSession] = useState(null)
  const [sessionCards, setSessionCards] = useState([])
  const [importMsg, setImportMsg] = useState(null)
  const [advanceDays, setAdvanceDays] = useState(3)
  const [showOptions, setShowOptions] = useState(() => window.innerWidth > 768)
  const [chevronHovered, setChevronHovered] = useState(false)
  const [backHovered, setBackHovered] = useState(false)
  const [startHovered, setStartHovered] = useState(false)
  const [audioHovered, setAudioHovered] = useState(false)
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
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const s = safeLocalStorageGet('srs-audio-enabled'); return s === null ? true : s === 'true'
  })
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const s = safeLocalStorageGet('srs-tts-enabled'); return s === null ? false : s === 'true'
  })
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
  useEffect(() => { safeLocalStorageSet('srs-audio-enabled', audioEnabled) }, [audioEnabled])
  useEffect(() => { safeLocalStorageSet('srs-tts-enabled', ttsEnabled) }, [ttsEnabled])
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

  if (loading && !progress) return null

  if (!user) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT }}>
        <header style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <a href="#/" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16, textDecoration: 'none', letterSpacing: TRACKING }}>
            Japanese Study
          </a>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, margin: '0 6px' }}>/</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>SRS</span>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 15, color: TEXT }}>Sign in to use Vocab SRS</div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 8 }}>Progress syncs to your account across devices</div>
          <button
            onClick={signIn}
            style={{ padding: '10px 24px', background: ACCENT, border: 'none', borderRadius: 8, color: '#fff', fontFamily: FONT, fontSize: 13, letterSpacing: TRACKING, cursor: 'pointer' }}
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

  function handleStartReview(newPerDay) {
    const { due: d, newCards: n, rescheduled } = getTodaysQueue(cardsObj, decks, { newPerDay })

    const prevCount = newCardDay.date === todayStr ? newCardDay.count : 0
    let currentProgress = {
      ...progress,
      newCardDay: { date: todayStr, count: prevCount + n.length },
    }

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
    setProgress(newProgress)
    save(newProgress)
  }

  function handleDrillDone(updatedSessionCards, goodCount) {
    const newCardsObj = { ...cardsObj, ...resolvedArrayToCardsObj(updatedSessionCards, decks) }
    const newProgress = {
      ...progress,
      cards: newCardsObj,
      lastSession: new Date().toISOString(),
      totalReviews: (progress.totalReviews ?? 0) + goodCount,
    }
    setProgress(newProgress)
    save(newProgress)
    setSession(null)
    setSessionCards([])
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
          <div style={{ fontSize: 13, color: TEXT_MUTED, padding: '4px 0 8px' }}>
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
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>Daily new cards</span>
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
                fontSize: 13,
                letterSpacing: TRACKING,
                textAlign: 'center',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: FONT }}>
              Leech threshold
              <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 6 }}>lapses (0 = off)</span>
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
                fontSize: 13,
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
          <DrawerCheckbox
            checked={audioEnabled}
            onChange={() => setAudioEnabled(v => !v)}
            label="Enable audio"
          />
          {audioEnabled && (
            <>
              <DrawerCheckbox
                checked={ttsEnabled}
                onChange={() => setTtsEnabled(v => !v)}
                label="Text to speech"
                indent={1}
              >
                {ttsEnabled && jaVoices.length > 0 && (
                  <DrawerSelect
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={[{ value: '', label: 'Default' }, ...jaVoices.map(v => ({ value: v.name, label: v.name }))]}
                    label="Voice"
                    subtext="Availability based on your device or browser"
                  />
                )}
              </DrawerCheckbox>
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
              <span style={{ fontSize: 13, color: TEXT_MUTED }}>Advance</span>
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
                  fontSize: 13,
                  letterSpacing: TRACKING,
                }}
              />
              <span style={{ fontSize: 13, color: TEXT_MUTED }}>days</span>
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
                  fontSize: 13,
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
                  fontSize: 13,
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
            pixelFont={pixelFont}
            showVisualEffects={showVisualEffects}
            ttsEnabled={audioEnabled && ttsEnabled}
            sfxEnabled={audioEnabled && sfxEnabled}
            ttsVoice={ttsVoice}
            showHardEasy={showHardEasy}
            leechThreshold={leechThreshold}
            isMobile={isMobile}
            onShowOptions={() => setShowOptions(v => !v)}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: TEXT }}>
            <header style={{
              display: 'flex',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}>
              <a
                href="#/"
                onMouseEnter={() => setBackHovered(true)}
                onMouseLeave={() => setBackHovered(false)}
                style={{
                  color: backHovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
                  fontSize: 16,
                  textDecoration: 'none',
                  letterSpacing: TRACKING,
                  transition: 'color 130ms',
                }}
              >
                Japanese Study
              </a>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, margin: '0 6px' }}>/</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>SRS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <AuthSlot />
                <button
                  onClick={() => setAudioEnabled(v => !v)}
                  onMouseEnter={() => setAudioHovered(true)}
                  onMouseLeave={() => setAudioHovered(false)}
                  title={audioEnabled ? 'Mute audio' : 'Enable audio'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34,
                    background: audioHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, cursor: 'pointer',
                    opacity: audioEnabled ? 1 : 0.35, padding: 0,
                    transition: 'background 130ms', color: 'rgba(255,255,255,0.8)',
                    fontSize: 16,
                  }}
                >
                  {audioEnabled ? '🔊' : '🔇'}
                </button>
                <button
                  onClick={() => setShowOptions(v => !v)}
                  onMouseEnter={() => setOptionsHovered(true)}
                  onMouseLeave={() => setOptionsHovered(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 34, padding: '0 12px', fontSize: 13,
                    fontFamily: 'inherit',
                    background: optionsHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'background 130ms',
                  }}
                >
                  {showOptions ? 'Hide options' : 'Show options'}
                </button>
              </div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
              <div style={{ maxWidth: 480, margin: '0 auto' }}>

                {activeDecks.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 60 }}>
                    <div style={{ fontSize: 16, color: TEXT, marginBottom: 8 }}>No active decks</div>
                    <div style={{ fontSize: 13, color: TEXT_MUTED }}>
                      Enable a deck in the settings panel to begin
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Global summary */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 22, color: TEXT, letterSpacing: TRACKING, marginBottom: 6 }}>
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
                              <span style={{ fontSize: 13, color: TEXT_MUTED }}>{deck.name}</span>
                              <span style={{ fontSize: 13, color: TEXT }}>
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
                        fontSize: 14,
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
                      <div style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: TRACKING, marginBottom: 10, textTransform: 'uppercase' }}>
                        Import
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <FileInput onChange={handleFileChange} />
                        {importMsg && (
                          <span style={{ fontSize: 13, color: '#4ade80' }}>{importMsg}</span>
                        )}
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
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Options</div>
              <button
                onClick={() => setShowOptions(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
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
