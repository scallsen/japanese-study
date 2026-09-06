import { useState, useEffect, useRef } from 'react'
import Popover from '../../components/Popover.jsx'
import Menu from '../../components/Menu.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { getDeckStats, getGlobalStats, getStateDistribution, getTodaysQueue, resolveCard, resetCardProgress, createCard, State } from './srs.js'
import { parseAnkiExport } from './import.js'
import { initSession } from './session.js'
import { migrateProgress, initializeDeckCards } from './migrate.js'
import VocabSrsDrill from './VocabSrsDrill.jsx'
import WordImportPanel from './WordImportPanel.jsx'
import { ensureDeck, createDeck, renameDeck, deleteCards } from './deckUtils.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import SettingsSidebar from '../../components/SettingsSidebar.jsx'
import SignInGate from '../../components/SignInGate.jsx'
import Button from '../../components/Button.jsx'
import NumberField from '../../components/NumberField.jsx'
import ToggleButton from '../../components/ToggleButton.jsx'
import Badge from '../../components/Badge.jsx'
import DistributionBar from '../../components/DistributionBar.jsx'
import DataList from '../../components/DataList.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_NAV, FS_CAPTION, FS_CONTENT_HEADING } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../../context/ModuleThemeContext.jsx'
import { STATE_SEGMENTS, SUSPENDED_DESCRIPTION } from './cardStates.js'
import SectionHeader from '../../components/SectionHeader.jsx'
import DrillSettingsPanel, { Row as SettingsRow } from '../../components/DrillSettingsPanel.jsx'
import FilterCard from '../../components/FilterCard.jsx'
import Switch from '../../components/Switch.jsx'
import { useDrillSettings, audioSourceForVoice } from '../../hooks/useDrillSettings.js'
import { useJaVoices } from '../../hooks/useTTS.js'
import { useAudioGenerationStatus } from '../../hooks/useAudioGenerationStatus.js'
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/storage.js'
import { getVoicevoxCredit, speakerIdFromAudioSource } from '../../utils/voicevoxAudio.js'
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

// The Decks list's name column — click-to-rename (imported decks only),
// same inline-edit behaviour the old sidebar DeckRow had. The row itself
// navigates to the deck's browse view, so every click here has to stop that:
// preventDefault (an ancestor <a>'s navigation is gated on the click event's
// canceled flag) and stopPropagation both, same reasoning DataList's own
// RowCheckbox uses for a selection control inside a navigable row.
function DeckNameCell({ deck, stats, onRename }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(deck.name)
  const canManage = deck.source === 'imported'
  const infoText = stats.total === 0
    ? 'not started'
    : `${stats.total} cards · ${stats.dueToday} due · ${stats.newAvailable} new`

  function commitRename() {
    setEditing(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== deck.name) onRename(trimmed)
    else setDraftName(deck.name)
  }

  return (
    <div style={{ minWidth: 0 }}>
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setDraftName(deck.name); setEditing(false) }
          }}
          style={{
            minWidth: 0, width: '100%', fontSize: FS_BASE, color: TEXT,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', letterSpacing: TRACKING,
          }}
        />
      ) : (
        <span
          onClick={canManage ? e => { e.preventDefault(); e.stopPropagation(); setEditing(true) } : undefined}
          title={canManage ? 'Click to rename' : undefined}
          style={{ fontSize: FS_BASE, color: deck.active ? TEXT : TEXT_MUTED, cursor: canManage ? 'text' : 'default' }}
        >
          {deck.name}
        </span>
      )}
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginTop: 2 }}>{infoText}</div>
    </div>
  )
}

// A single "Import" trigger opening the two existing import flows in a
// popover menu, rather than two separate buttons sitting side by side.
// "Choose .txt file" still needs a real file picker, which a Menu item's
// plain onClick can't open by itself — so this keeps its own hidden
// <input type="file"> (the same pattern FileButton uses) and clicks it from
// the menu selection instead of rendering FileButton inside the popover.
function ImportMenuButton({ onFile, onOpenWordImport, isMobile }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const inputRef = useRef(null)

  const items = [
    { id: 'txt', label: 'Choose .txt file', onClick: () => inputRef.current?.click() },
    { id: 'text-image', label: 'Import from text / image', onClick: onOpenWordImport },
  ]

  return (
    <>
      <Button ref={btnRef} variant="neutral" onClick={() => setOpen(o => !o)}>Import ▾</Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} isMobile={isMobile} align="start" width={220} bodyPadding={0}>
        <Menu items={items} onSelect={id => { setOpen(false); items.find(i => i.id === id)?.onClick() }} />
      </Popover>
      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </>
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
  const [showWordImport, setShowWordImport] = useState(false)
  const [advanceDays, setAdvanceDays] = useState(3)
  const [showOptions, setShowOptions] = useState(() => window.innerWidth > 768)

  const { settings, set: setSetting } = useDrillSettings('srs')
  const anyAudio = settings.frontAudio || settings.backAudio
  const audioSource = anyAudio ? audioSourceForVoice(settings.voice) : 'none'
  const voicevoxCredit = anyAudio ? getVoicevoxCredit(audioSource) : null
  const [dailyNewCards, setDailyNewCards] = useState(() => {
    const s = safeLocalStorageGet('srs-daily-new-cards'); return s ? parseInt(s, 10) : 10
  })
  const [showHardEasy, setShowHardEasy] = useState(() => {
    const s = safeLocalStorageGet('srs-show-hard-easy'); return s === null ? true : s === 'true'
  })
  const [leechThreshold, setLeechThreshold] = useState(() => {
    const s = safeLocalStorageGet('srs-leech-threshold'); return s ? parseInt(s, 10) : 8
  })

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
  // Rendered only when there is something to credit — an empty footnote block
  // would still occupy space under the audio group.
  const audioFootnote = (voicevoxCredit || audioProcessing) ? (
    <>
      {voicevoxCredit && <div>{renderAttributionSegments(voicevoxCredit)}</div>}
      {audioProcessing && <div>Audio is being generated</div>}
    </>
  ) : null

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
  const activeDecks = deckList.filter(d => d.active)

  // The Decks list's columns — name (+ inline rename), a per-deck learning-
  // stage bar, and the on/off toggle. Both the toggle and the name's rename
  // affordance stop the click from also firing the row's own navigate.
  const deckColumns = [
    {
      key: 'name', flex: 2,
      render: deck => <DeckNameCell deck={deck} stats={getDeckStats(cardsObj, deck.id)} onRename={name => handleRenameDeck(deck.id, name)} />,
    },
    {
      key: 'dist', flex: 1.4,
      render: deck => (
        <div style={{ width: '100%' }}>
          {/* getStateDistribution filters to active decks — force it here so
              a toggled-off deck's bar still reflects its real cards, matching
              the count text beside it (getDeckStats doesn't gate on active). */}
          <DistributionBar
            segments={STATE_SEGMENTS.map(s => ({ ...s, count: getStateDistribution(cardsObj, { [deck.id]: { ...deck, active: true } })[s.key] ?? 0 }))}
            showLegend={false}
          />
        </div>
      ),
    },
    {
      key: 'toggle', width: 64, align: 'right',
      render: deck => (
        <span onClick={e => e.stopPropagation()}>
          <ToggleButton active={deck.active} labels={{ on: 'On', off: 'Off' }} onClick={() => handleToggleDeck(deck.id)} />
        </span>
      ),
    },
  ]

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
      showToast({ message: 'No new cards found' })
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
    showToast({ message: `${imported.length} card${imported.length === 1 ? '' : 's'} imported` })
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

  // Card front/back/audio/interface settings only mean something with a card
  // actually on screen, so this is only ever mounted during an active
  // session — see the sidebar's conditional render below. SRS Settings and
  // Dev tools live inline in the overview's main content instead (see
  // OverviewSettings), since there's no sidebar to put them in there.
  function renderPanelContent(paddingH) {
    return (
      <div style={{ padding: `16px ${paddingH}px 16px` }}>
        <DrillSettingsPanel
          settings={settings}
          onChange={setSetting}
          backupVoices={jaVoices}
          audioFootnote={audioFootnote}
        />
      </div>
    )
  }

  function renderOverviewSettings() {
    const hairline = { height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }
    return (
      <div>
        <SectionHeader title="SRS Settings" />
        <FilterCard>
          <SettingsRow
            label="Daily new cards"
            control={<NumberField value={dailyNewCards} min={1} onChange={v => setDailyNewCards(Math.max(1, parseInt(v) || 1))} />}
          />
          <SettingsRow
            label={<>Leech threshold<span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 6 }}>lapses (0 = off)</span></>}
            control={<NumberField value={leechThreshold} min={0} onChange={v => setLeechThreshold(Math.max(0, parseInt(v) || 0))} />}
          />
          <SettingsRow
            label="Show Hard / Easy buttons"
            onActivate={() => setShowHardEasy(v => !v)}
            control={<Switch checked={showHardEasy} onChange={() => setShowHardEasy(v => !v)} label="Show Hard / Easy buttons" />}
          />
        </FilterCard>

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
            showTranslation={settings.translation}
            showFurigana={settings.furigana}
            showSentence={settings.sentence}
            showKanjiMeaning={settings.kanjiMeanings}
            pixelFont={settings.pixelFont}
            showVisualEffects={settings.visualEffects}
            audioEnabled={anyAudio}
            autoplayFront={settings.frontAudio}
            autoplayBack={settings.backAudio}
            audioSource={audioSource}
            sfxEnabled={settings.sfx}
            ttsVoice={settings.backupVoice}
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
              rightSlot={<AuthSlot />}
            />

            <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ maxWidth: 820, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>

                {activeDecks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
                    <div style={{ fontSize: FS_NAV, color: TEXT, marginBottom: 8 }}>No active decks</div>
                    <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>Turn one on below to begin.</div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, letterSpacing: TRACKING }}>
                          {canStart
                            ? `${due.length + rescheduled.length} due · ${newCards.length} new · ~${Math.ceil((due.length + rescheduled.length + newCards.length) * 0.25) || '<1'} min`
                            : 'Nothing due'}
                        </div>
                        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: 4 }}>
                          {activeDecks.length} active {activeDecks.length === 1 ? 'deck' : 'decks'} · {globalStats.totalCards} cards
                        </div>
                      </div>
                      <Button variant="accent-outline" size="lg" onClick={() => handleStartReview(effectiveNewPerDay)} disabled={!canStart}>
                        {canStart ? `Start review (${due.length + rescheduled.length + newCards.length})` : 'Nothing due'}
                      </Button>
                    </div>
                    {stateDistribution.total > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <DeckProgressBar distribution={stateDistribution} />
                        <a href="#/vocab-srs/browse" className="srs-browse-link" style={{ display: 'inline-block', marginTop: 12, fontSize: FS_BASE, color: ACCENT }}>
                          View all cards →
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 28 }}>
                  <SectionHeader title={`Decks · ${activeDecks.length} of ${deckList.length} on`} />
                  <DataList
                    columns={deckColumns}
                    rows={deckList}
                    maxWidth="100%"
                    navigate={{ href: deck => `#/vocab-srs/browse?deck=${deck.id}` }}
                  />
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, marginBottom: 28 }}>
                  {renderOverviewSettings()}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <ImportMenuButton onFile={handleFileChange} onOpenWordImport={() => setShowWordImport(true)} isMobile={isMobile} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                    {Object.keys(cardsObj).length} total cards
                  </div>
                </div>
                </div>

                <AttributionFooter sources={[
                  'dictionary',
                  'tanaka-corpus',
                  ...(speakerIdFromAudioSource(audioSource) ? ['voicevox'] : []),
                ]} />
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Card front/back/audio/interface settings only mean something with a
          card on screen — no sidebar at all on the overview; SRS Settings
          and Dev tools live inline there instead (renderOverviewSettings). */}
      {session && (
        <SettingsSidebar
          open={showOptions}
          onToggle={() => setShowOptions(v => !v)}
          onClose={() => setShowOptions(false)}
          isMobile={isMobile}
        >
          {renderPanelContent}
        </SettingsSidebar>
      )}

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
