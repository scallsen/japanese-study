import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { migrateProgress } from './migrate.js'
import { resolveCard, cardStateLabel } from './srs.js'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import DrawerSelect from '../../components/DrawerSelect.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION } from '../../data/theme.js'

const ACCENT = '#3ABDA4'
const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const PAGE_SIZE = 50

// Same ramp as the home-screen progress bar (VocabSrsModule.jsx) — kept as a
// local copy since it's a small, page-specific UI concern, not FSRS logic.
const STATE_COLORS = { new: '#aaaaaa', learning: '#4c8a7d', young: '#5eb6a2', mature: '#7fe0c8', relearning: '#e0a72e' }
const STATE_LABELS = { new: 'Unlearned', learning: 'Learning', young: 'Young', mature: 'Mature', relearning: 'Relearning' }
const STATE_DESCRIPTIONS = {
  new: 'Never reviewed — waiting for its first study session',
  learning: 'Answered correctly once, but not yet graduated to a real spaced interval',
  young: 'Graduated, but its current interval is under 21 days — still fragile',
  mature: 'Graduated with a 21+ day interval — well established',
  relearning: 'Was graduated, just answered wrong — cooling down before rejoining the queue',
}
const SUSPENDED_DESCRIPTION = 'Paused after too many lapses (leech threshold) — won\'t appear in reviews until its progress is reset'

const STATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'new', label: 'Unlearned' },
  { value: 'learning', label: 'Learning' },
  { value: 'young', label: 'Young' },
  { value: 'mature', label: 'Mature' },
  { value: 'relearning', label: 'Relearning' },
  { value: 'suspended', label: 'Suspended' },
]

function StateTabs({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="srs-tab"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${selected ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.12)'}`,
              background: selected ? 'rgba(58,189,164,0.15)' : undefined,
              color: selected ? ACCENT : TEXT_MUTED,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: TRACKING,
            }}
          >
            <span style={{ fontSize: FS_CAPTION, fontVariantNumeric: 'tabular-nums' }}>{opt.count}</span>
            <span style={{ fontSize: FS_BASE }}>{opt.label}</span>
          </button>
        )
      })}
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

function CardRow({ card, showDeck }) {
  const label = cardStateLabel(card)
  const showKana = card.kana && card.kana !== card.front

  return (
    <div className="srs-browse-row" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
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
      <span
        title={STATE_DESCRIPTIONS[label]}
        style={{
          fontSize: FS_CAPTION,
          color: STATE_COLORS[label],
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${STATE_COLORS[label]}55`,
          borderRadius: 4,
          padding: '2px 8px',
          flexShrink: 0,
          cursor: 'help',
        }}>
        {STATE_LABELS[label]}
      </span>
      {card.suspended && (
        <span
          title={SUSPENDED_DESCRIPTION}
          style={{
            fontSize: FS_CAPTION,
            color: '#f87171',
            background: 'rgba(192,57,43,0.15)',
            border: '1px solid rgba(192,57,43,0.4)',
            borderRadius: 4,
            padding: '2px 8px',
            flexShrink: 0,
            cursor: 'help',
          }}>
          Suspended
        </span>
      )}
      <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
        {formatDue(card.due)}
      </span>
    </div>
  )
}

export default function VocabSrsBrowsePage() {
  const { user, signIn } = useAuth()
  const { data: rawProgress, loading } = useProgress('vocab-srs')

  const [stateFilter, setStateFilter] = useState('all')
  const [deckFilter, setDeckFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
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

  if (loading && !progress) return null

  if (!user) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT }}>
        <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'SRS', href: '#/vocab-srs' }, { label: 'Browse cards' }]} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: FS_BASE, color: TEXT }}>Sign in to browse your SRS cards</div>
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

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

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
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 60px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ minWidth: 200, maxWidth: 320, marginBottom: 20 }}>
            <DrawerSelect
              value={deckFilter}
              onChange={setDeckFilter}
              options={[{ value: 'all', label: 'All decks' }, ...deckList.map(d => ({ value: d.id, label: d.name }))]}
              label="Deck"
            />
          </div>

          <StateTabs
            options={STATE_FILTER_OPTIONS.map(opt => ({ ...opt, count: stateTabCounts[opt.value] ?? 0 }))}
            value={stateFilter}
            onChange={setStateFilter}
          />

          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 20,
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: TEXT,
              fontFamily: 'inherit',
              fontSize: FS_BASE,
              letterSpacing: TRACKING,
            }}
          />

          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 10 }}>
            {filtered.length} card{filtered.length === 1 ? '' : 's'}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontSize: FS_BASE }}>
              No cards match your filters
            </div>
          ) : (
            <>
              <div style={{ background: SURFACE, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                {visible.map(card => (
                  <CardRow key={card.id} card={card} showDeck={deckFilter === 'all'} />
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                    style={{
                      fontSize: FS_BASE,
                      fontFamily: 'inherit',
                      letterSpacing: TRACKING,
                      color: TEXT_MUTED,
                      background: SURFACE,
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      padding: '8px 28px',
                      cursor: 'pointer',
                    }}
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
