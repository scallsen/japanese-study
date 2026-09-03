import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { migrateProgress } from './migrate.js'
import { resolveCard, cardStateLabel } from './srs.js'
import { moveCardsToDeck, deleteCards, createDeck, deleteDeck, isBundledDeck } from './deckUtils.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import Select from '../../components/Select.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import DeckComboBox from '../../components/DeckComboBox.jsx'
import DataList from '../../components/DataList.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import TextInput from '../../components/TextInput.jsx'
import ToggleButton from '../../components/ToggleButton.jsx'
import ChipSelector from '../../components/Chip.jsx'
import SignInGate from '../../components/SignInGate.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, SEGMENT_COLORS } from '../../data/theme.js'
import { MODULES } from '../../data/modules.js'
import { ModuleThemeProvider } from '../../context/ModuleThemeContext.jsx'
import { STATE_LABELS, STATE_DESCRIPTIONS, SUSPENDED_DESCRIPTION } from './cardStates.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

function parseHashQuery() {
  const hash = window.location.hash.slice(1)
  const qIndex = hash.indexOf('?')
  return new URLSearchParams(qIndex === -1 ? '' : hash.slice(qIndex + 1))
}

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const PAGE_SIZE = 50
const SRS_ACCENT = MODULES.find(m => m.id === 'vocab-srs').accent

const STATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'new', label: 'Unlearned' },
  { value: 'learning', label: 'Learning' },
  { value: 'young', label: 'Young' },
  { value: 'mature', label: 'Mature' },
  { value: 'relearning', label: 'Relearning' },
  { value: 'suspended', label: 'Suspended' },
]

// Each tab is a count over a label — Chip takes any node as its label, so
// the stacked pair is just content; the selection model is ChipSelector's.
function StateTabs({ options, value, onChange }) {
  const chipOptions = options.map(opt => ({
    value: opt.value,
    label: (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: FS_CAPTION, fontVariantNumeric: 'tabular-nums' }}>{opt.count}</span>
        <span style={{ fontSize: FS_BASE }}>{opt.label}</span>
      </span>
    ),
  }))
  return (
    <div style={{ marginBottom: 20 }}>
      <ChipSelector mode="single" size="md" options={chipOptions} value={value} onChange={onChange} />
    </div>
  )
}

function formatDue(dueIso) {
  if (!dueIso) return ''
  const diffDays = Math.round((new Date(dueIso) - Date.now()) / 86400000)
  if (diffDays === 0) return 'due today'
  if (diffDays < 0) return `${-diffDays}d overdue`
  return `in ${diffDays}d`
}

// Content-only; DataList supplies the row shell, divider, hover and (in
// manage mode) the checkbox.
function cardRowContent(card, showDeck) {
  const label = cardStateLabel(card)
  const showKana = card.kana && card.kana !== card.front
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: FS_BASE, color: TEXT }}>{card.front}</span>
          {showKana && <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>{card.kana}</span>}
        </div>
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.back}
        </div>
      </div>
      {showDeck && (
        <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, flexShrink: 0 }}>{card.deckName}</span>
      )}
      <span title={STATE_DESCRIPTIONS[label]} style={{ cursor: 'help', display: 'inline-flex' }}>
        <Badge tone="accent" accent={SEGMENT_COLORS[label]}>{STATE_LABELS[label]}</Badge>
      </span>
      {card.suspended && (
        <span title={SUSPENDED_DESCRIPTION} style={{ cursor: 'help', display: 'inline-flex' }}>
          <Badge tone="danger">Suspended</Badge>
        </span>
      )}
      <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
        {formatDue(card.due)}
      </span>
    </div>
  )
}

export default function VocabSrsBrowsePage() {
  return (
    <ModuleThemeProvider accent={SRS_ACCENT}>
      <BrowseCards />
    </ModuleThemeProvider>
  )
}

function BrowseCards() {
  const { user, signIn } = useAuth()
  const { data: rawProgress, save, loading } = useProgress('vocab-srs')
  const { showToast } = useToast()
  const isMobile = useIsMobile()

  const [stateFilter, setStateFilter] = useState('all')
  const [deckFilter, setDeckFilter] = useState(() => parseHashQuery().get('deck') || 'all')
  const [manageMode, setManageMode] = useState(() => parseHashQuery().get('manage') === '1')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [confirmingDeckDelete, setConfirmingDeckDelete] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setSelected(new Set())
  }, [stateFilter, deckFilter, search])

  const progress = useMemo(() => (loading ? null : migrateProgress(rawProgress)), [loading, rawProgress])
  const decks = useMemo(() => progress?.decks ?? {}, [progress])
  const cardsObj = useMemo(() => progress?.cards ?? {}, [progress])

  const deckList = useMemo(
    () => Object.values(decks).sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0)),
    [decks]
  )

  const allCards = useMemo(
    () => Object.values(cardsObj).map(card => ({
      ...resolveCard(card),
      deckName: decks[card.deckId]?.name ?? card.deckId,
    })),
    [cardsObj, decks]
  )

  const deckScopedCards = useMemo(
    () => (deckFilter === 'all' ? allCards : allCards.filter(c => c.deckId === deckFilter)),
    [allCards, deckFilter]
  )

  // Tab counts reflect the deck filter only, not search/state — so they stay
  // stable reference points while switching between tabs or typing a search.
  const stateTabCounts = useMemo(() => {
    const counts = { all: deckScopedCards.length, new: 0, learning: 0, young: 0, mature: 0, relearning: 0, suspended: 0 }
    for (const c of deckScopedCards) {
      counts[cardStateLabel(c)]++
      if (c.suspended) counts.suspended++
    }
    return counts
  }, [deckScopedCards])

  const filtered = useMemo(() => {
    let list = deckScopedCards
    if (stateFilter === 'suspended') list = list.filter(c => c.suspended)
    else if (stateFilter !== 'all') list = list.filter(c => cardStateLabel(c) === stateFilter)
    if (search) {
      list = list.filter(c =>
        c.front?.toLowerCase().includes(search) ||
        c.kana?.toLowerCase().includes(search) ||
        c.back?.toLowerCase().includes(search)
      )
    }
    return [...list].sort((a, b) => new Date(a.due) - new Date(b.due))
  }, [deckScopedCards, stateFilter, search])

  const someFilteredSelected = filtered.some(c => selected.has(c.id))

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    const ids = [...selected]
    const deletedCards = ids.map(id => cardsObj[id]).filter(Boolean)
    const newCardsObj = deleteCards(cardsObj, ids)
    save({ ...progress, cards: newCardsObj })
    setSelected(new Set())
    setConfirmingBulkDelete(false)
    showToast({
      message: `Deleted ${deletedCards.length} card${deletedCards.length === 1 ? '' : 's'}.`,
      actionLabel: 'Undo',
      onAction: () => handleUndoBulkDelete(deletedCards),
    })
  }

  function handleUndoBulkDelete(deletedCards) {
    const restoredCardsObj = { ...cardsObj }
    for (const card of deletedCards) restoredCardsObj[card.id] = card
    save({ ...progress, cards: restoredCardsObj })
  }

  function handleBulkMove(targetDeckId) {
    const ids = [...selected]
    const originalDeckIds = ids.map(id => [id, cardsObj[id]?.deckId])
    const newCardsObj = moveCardsToDeck(cardsObj, ids, targetDeckId)
    save({ ...progress, cards: newCardsObj })
    setSelected(new Set())
    showToast({
      message: `Moved ${ids.length} card${ids.length === 1 ? '' : 's'} to "${decks[targetDeckId]?.name ?? 'deck'}".`,
      actionLabel: 'Undo',
      onAction: () => handleUndoBulkMove(originalDeckIds),
    })
  }

  function handleBulkMoveCreateDeck(name) {
    const ids = [...selected]
    const originalDeckIds = ids.map(id => [id, cardsObj[id]?.deckId])
    const { decks: newDecks, deckId } = createDeck(decks, name)
    const newCardsObj = moveCardsToDeck(cardsObj, ids, deckId)
    save({ ...progress, decks: newDecks, cards: newCardsObj })
    setSelected(new Set())
    showToast({
      message: `Moved ${ids.length} card${ids.length === 1 ? '' : 's'} to "${name}".`,
      actionLabel: 'Undo',
      onAction: () => handleUndoBulkMove(originalDeckIds),
    })
  }

  function handleUndoBulkMove(originalDeckIds) {
    const restoredCardsObj = { ...cardsObj }
    for (const [id, deckId] of originalDeckIds) {
      if (restoredCardsObj[id] && deckId) restoredCardsObj[id] = { ...restoredCardsObj[id], deckId }
    }
    save({ ...progress, cards: restoredCardsObj })
  }

  function handleDeleteDeck() {
    const deckId = deckFilter
    const deletedDeck = decks[deckId]
    const deletedCards = Object.values(cardsObj).filter(c => c.deckId === deckId)
    const newProgress = deleteDeck(progress, deckId)
    save(newProgress)
    setConfirmingDeckDelete(false)
    showToast({
      message: `Deleted "${deletedDeck?.name}" and its ${deletedCards.length} card${deletedCards.length === 1 ? '' : 's'}.`,
      actionLabel: 'Undo',
      onAction: () => handleUndoDeleteDeck(deletedDeck, deletedCards),
    })
    window.location.hash = '#/vocab-srs'
  }

  function handleUndoDeleteDeck(deletedDeck, deletedCards) {
    if (!deletedDeck) return
    const restoredDecks = { ...decks, [deletedDeck.id]: deletedDeck }
    const restoredCardsObj = { ...cardsObj }
    for (const card of deletedCards) restoredCardsObj[card.id] = card
    save({ ...progress, decks: restoredDecks, cards: restoredCardsObj })
  }

  if (loading && !progress) return null

  if (!user) {
    return (
      <SignInGate
        crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS', href: '#/vocab-srs' }, { label: 'Browse cards' }]}
        title="Sign in to browse your SRS cards"
        onSignIn={signIn}
      />
    )
  }

  if (!progress) return null

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount
  const canDeleteThisDeck = deckFilter !== 'all' && decks[deckFilter] && !isBundledDeck(decks[deckFilter])
  const showDeck = deckFilter === 'all'
  const columns = [{ key: 'card', wrap: true, render: card => cardRowContent(card, showDeck) }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BG, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'SRS', onClick: () => { window.location.hash = '#/vocab-srs' } },
          { label: 'Browse cards' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <main style={{ flex: 1, overflowY: 'auto', padding: `24px 24px ${manageMode && someFilteredSelected ? 96 : 60}px` }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ minWidth: 200, maxWidth: 320 }}>
              <Select
                value={deckFilter}
                onChange={setDeckFilter}
                options={[{ value: 'all', label: 'All decks' }, ...deckList.map(d => ({ value: d.id, label: d.name }))]}
                label="Deck"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {canDeleteThisDeck && (
                <Button variant="danger-outline" size="sm" onClick={() => setConfirmingDeckDelete(true)}>Delete deck</Button>
              )}
              <ToggleButton
                active={manageMode}
                labels={{ on: 'Done selecting', off: 'Select' }}
                size="md"
                onClick={() => { setManageMode(v => !v); setSelected(new Set()) }}
              />
            </div>
          </div>

          <StateTabs
            options={STATE_FILTER_OPTIONS.map(opt => ({ ...opt, count: stateTabCounts[opt.value] ?? 0 }))}
            value={stateFilter}
            onChange={setStateFilter}
          />

          <TextInput value={searchInput} onChange={setSearchInput} placeholder="Search..." style={{ marginBottom: 20 }} />

          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 10 }}>
            {filtered.length} card{filtered.length === 1 ? '' : 's'}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontSize: FS_BASE }}>
              No cards match your filters
            </div>
          ) : (
            <DataList
              columns={columns}
              rows={visible}
              selection={manageMode ? { selected, onToggle: toggleRow, bulkHeader: true } : undefined}
              padding="12px 16px"
              gap={14}
              maxWidth="100%"
              footer={hasMore ? <Button variant="neutral" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>Load more</Button> : undefined}
            />
          )}
        </div>
      </main>

      {manageMode && someFilteredSelected && (
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          padding: '14px 16px',
          background: SURFACE,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Button variant="danger-outline" onClick={() => setConfirmingBulkDelete(true)}>Delete ({selected.size})</Button>
          <DeckComboBox
            decks={decks}
            isMobile={isMobile}
            buttonLabel={`Move to deck (${selected.size})`}
            title={`Move ${selected.size} card${selected.size === 1 ? '' : 's'} to`}
            onAdd={handleBulkMove}
            onCreateAndAdd={handleBulkMoveCreateDeck}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmingBulkDelete}
        title="Delete cards"
        message={`Delete ${selected.size} card${selected.size === 1 ? '' : 's'}? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmingBulkDelete(false)}
      />

      <ConfirmDialog
        open={confirmingDeckDelete}
        title="Delete deck"
        message={canDeleteThisDeck
          ? `Delete "${decks[deckFilter]?.name}" and its ${deckScopedCards.length} card${deckScopedCards.length === 1 ? '' : 's'}? This can't be undone.`
          : ''}
        confirmLabel="Delete"
        onConfirm={handleDeleteDeck}
        onCancel={() => setConfirmingDeckDelete(false)}
      />
    </div>
  )
}
