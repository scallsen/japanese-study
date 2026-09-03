import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { syncEpisodeVocab } from './api.js'
import { useDictionaryEntries } from '../../hooks/useDictionaryEntries.js'
import { briefGloss } from '../../utils/dictionaryEntryLookup.js'
import { useProgress } from '../../hooks/useProgress.js'
import { migrateProgress } from '../vocab-srs/migrate.js'
import { buildJmdictIdCardIndex, resolveStatus } from './srsStatusResolver.js'
import Button from '../../components/Button.jsx'
import DataList from '../../components/DataList.jsx'
import ActionBar from '../../components/ActionBar.jsx'
import Badge from '../../components/Badge.jsx'
import { Chip, default as ChipSelector } from '../../components/Chip.jsx'
import FilterCard, { FilterRow } from '../../components/FilterCard.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE, KANJI_FONT } from '../../data/theme.js'
import { useAccent } from '../../context/ModuleThemeContext.jsx'

const DEFAULT_WORD_LIMIT = 20
// global_frequency_rank = this word's rank across ALL of Jiten's indexed
// media (rank 1 = most common word in Japanese overall), not just this
// episode. 200 was picked empirically against a synced episode: it catches
// pure filler (これ/其れ/此の/為/言う/私/俺 — all rank < 100) plus 僕[ぼく]
// (rank 190), while leaving words ranked 200+ (世界, 部屋, 心, 先生, 新しい)
// alone, since those start looking like genuinely useful/notable vocabulary.
const GENERIC_RANK_THRESHOLD = 200

// Community-estimated JLPT levels (no official list exists — see
// scripts/import-jlpt-vocab.mjs), so a word with no jlpt_level match is left
// in rather than assumed easy — the level filter only ever removes words we
// have positive (if approximate) data for.
const JLPT_LEVEL_ORDER = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
// "any" isn't a threshold point (it means "disable the filter"), so it's a
// standalone Chip beside the 4-option ChipSelector rather than a 5th option
// — passing it as an option would either misrender (thresholdIndex -1 shows
// nothing active, not "everything") or, worse, light every chip if it ever
// matched index 0.
const JLPT_CHIP_OPTIONS = [
  { value: 'N4', label: 'N4' },
  { value: 'N3', label: 'N3' },
  { value: 'N2', label: 'N2' },
  { value: 'N1', label: 'N1' },
]

const STATUS_LABEL = { new: 'New', learning: 'Learning', young: 'Young', mature: 'Mature', relearning: 'Relearning', 'not-in-deck': null }
const STATUS_COLOR = { new: TEXT_MUTED, learning: '#fbbf24', young: '#60a5fa', mature: '#4ade80', relearning: '#f87171' }

// SRS status pill stays a bespoke color rather than routing through Badge's
// tone system — "young"'s blue (#60a5fa) has no matching semantic tone
// (accent/success/warning/danger/neutral), and this 4-color status palette
// isn't reused elsewhere, so it doesn't earn a place in Badge's fixed set.
const WORD_COLUMNS = [
  { key: 'displayForm', width: 90, fontFamily: KANJI_FONT, fontSize: FS_LIST_TITLE, render: row => row.displayForm },
  { key: 'reading', width: 70, fontFamily: KANJI_FONT, tone: 'muted', render: row => (row.reading && row.reading !== row.displayForm ? row.reading : '') },
  { key: 'gloss', flex: 1, tone: 'muted', render: row => row.gloss ?? (row.jmdict_id ? '' : '(no dictionary match)') },
  {
    key: 'badges', width: 160,
    render: row => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {row.jlptLevel && (
          <span title={row.jlptLevelInferred ? 'Approximate — inferred from a related word, not directly sourced' : undefined}>
            <Badge tone="accent" dimmed={row.jlptLevelInferred}>{row.jlptLevelInferred ? `~${row.jlptLevel}` : row.jlptLevel}</Badge>
          </span>
        )}
        {row.is_grammar && <Badge variant="text" tone="neutral">grammar</Badge>}
        {row.is_name && <Badge variant="text" tone="neutral">name</Badge>}
        {STATUS_LABEL[row.status] && (
          <span style={{ fontSize: FS_BADGE, color: STATUS_COLOR[row.status], fontFamily: FONT, letterSpacing: TRACKING }}>{STATUS_LABEL[row.status]}</span>
        )}
      </div>
    ),
  },
  { key: 'occurrence_count', width: 30, align: 'right', tone: 'muted', render: row => row.occurrence_count ?? '' },
]


export default function EpisodeVocabBrowser({ media, episode, onStartDrill, onLoadingChange }) {
  const ACCENT = useAccent()
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    onLoadingChange?.(loading)
    return () => onLoadingChange?.(false)
  }, [loading, onLoadingChange])
  const showLoadingMessage = useDelayedLoading(loading)

  const [includeGrammar, setIncludeGrammar] = useState(false)
  const [includeNames, setIncludeNames] = useState(false)
  const [includeGeneric, setIncludeGeneric] = useState(false)
  const [minJlptLevel, setMinJlptLevel] = useState('any')
  const [includeKnown, setIncludeKnown] = useState(true)
  const [lookupQuery, setLookupQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  // True once the user has made an explicit selection choice (individual
  // toggle, select-all, or a bulk "select first N" confirm) — until then,
  // filter changes keep re-selecting the top DEFAULT_WORD_LIMIT eligible
  // words so the list isn't empty on first load.
  const [selectionTouched, setSelectionTouched] = useState(false)

  const { data: srsData } = useProgress('vocab-srs')
  const cardIndex = useMemo(() => buildJmdictIdCardIndex(migrateProgress(srsData)), [srsData])

  const jmdictIds = useMemo(() => occurrences.map(o => o.jmdict_id).filter(Boolean), [occurrences])
  const { entries: dictEntries } = useDictionaryEntries(jmdictIds, true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!episode.synced_at) {
          setSyncing(true)
          await syncEpisodeVocab(episode.id)
          setSyncing(false)
        }
        const { data, error: fetchErr } = await supabase
          .from('media_vocab_occurrence').select('*').eq('media_episode_id', episode.id).order('frequency_rank')
        if (fetchErr) throw fetchErr
        if (!cancelled) setOccurrences(data ?? [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) { setLoading(false); setSyncing(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [episode.id, episode.synced_at])

  const rows = useMemo(() => occurrences.map(o => {
    const dictEntry = o.jmdict_id ? dictEntries[o.jmdict_id] : null
    const status = resolveStatus(o.jmdict_id, cardIndex)
    return {
      ...o,
      displayForm: dictEntry?.primary_form ?? o.surface_form,
      reading: dictEntry?.kana_forms?.[0] ?? null,
      gloss: briefGloss(dictEntry),
      jlptLevel: dictEntry?.jlpt_level ?? null,
      jlptLevelInferred: dictEntry?.jlpt_level_inferred ?? false,
      status,
    }
  }), [occurrences, dictEntries, cardIndex])

  const candidateRows = useMemo(() => rows.filter(r => r.jmdict_id), [rows])
  const grammarCount = useMemo(() => candidateRows.filter(r => r.is_grammar).length, [candidateRows])
  const namesCount = useMemo(() => candidateRows.filter(r => r.is_name).length, [candidateRows])
  const genericCount = useMemo(() =>
    candidateRows.filter(r => r.global_frequency_rank != null && r.global_frequency_rank <= GENERIC_RANK_THRESHOLD).length,
    [candidateRows]
  )
  const knownCount = useMemo(() => candidateRows.filter(r => r.status === 'young' || r.status === 'mature').length, [candidateRows])

  // The four filter checkboxes as one multi-select chip row — independent
  // toggles, so the Set ChipSelector hands back on each click can be
  // decomposed straight into the four booleans, no diffing needed (unlike
  // MediaSearch's Difficulty row, which has its own "snap back to All when
  // empty" behavior).
  const filterOptions = [
    { value: 'grammar', label: `Grammar words (${grammarCount})` },
    { value: 'names', label: `Names (${namesCount})` },
    { value: 'generic', label: `Very common words (${genericCount})` },
    { value: 'known', label: `Known (${knownCount})` },
  ]
  const filterValue = new Set([
    includeGrammar && 'grammar',
    includeNames && 'names',
    includeGeneric && 'generic',
    includeKnown && 'known',
  ].filter(Boolean))
  function handleFilterChange(next) {
    setIncludeGrammar(next.has('grammar'))
    setIncludeNames(next.has('names'))
    setIncludeGeneric(next.has('generic'))
    setIncludeKnown(next.has('known'))
  }

  const eligible = useMemo(() =>
    candidateRows
      .filter(r => includeGrammar || !r.is_grammar)
      .filter(r => includeNames || !r.is_name)
      .filter(r => includeGeneric || r.global_frequency_rank == null || r.global_frequency_rank > GENERIC_RANK_THRESHOLD)
      .filter(r => minJlptLevel === 'any' || r.jlptLevel == null || JLPT_LEVEL_ORDER[r.jlptLevel] >= JLPT_LEVEL_ORDER[minJlptLevel])
      .filter(r => includeKnown || (r.status !== 'young' && r.status !== 'mature'))
      .sort((a, b) => (a.frequency_rank ?? 0) - (b.frequency_rank ?? 0)),
    [candidateRows, includeGrammar, includeNames, includeGeneric, minJlptLevel, includeKnown]
  )

  // Auto-select the top DEFAULT_WORD_LIMIT eligible words whenever filters
  // change, unless the user has made an explicit selection choice.
  useEffect(() => {
    if (selectionTouched) return
    setSelected(new Set(eligible.slice(0, DEFAULT_WORD_LIMIT).map(r => r.id)))
  }, [eligible, selectionTouched])

  const displayedRows = useMemo(() => {
    const q = lookupQuery.trim()
    if (!q) return eligible
    return rows.filter(r =>
      r.displayForm?.includes(q) || r.reading?.includes(q) || r.surface_form?.includes(q) || r.gloss?.toLowerCase().includes(q.toLowerCase())
    )
  }, [rows, eligible, lookupQuery])

  function toggleRow(id) {
    setSelectionTouched(true)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleStartDrill() {
    const words = rows
      .filter(r => selected.has(r.id))
      .map(r => ({
        id: `anime-vocab-${r.id}`,
        kanji: r.displayForm,
        kana: r.reading ?? r.displayForm,
        english: r.gloss ?? '',
        sentence: null,
        jmdictId: r.jmdict_id,
      }))
    if (words.length) onStartDrill(words)
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {showLoadingMessage && (
          <CenteredLoadingMessage text={syncing ? 'Syncing details from Jiten' : 'Loading episode vocabulary'} />
        )}
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', fontSize: FS_BASE, color: '#f87171', fontFamily: FONT, letterSpacing: TRACKING }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: FS_LIST_TITLE + 4, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 4 }}>
          {media.title} — {episode.title || `Episode ${episode.episode_number}`}
        </div>
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {occurrences.length} words total, {eligible.length} eligible for drilling
        </div>
      </div>

      <FilterCard>
        <FilterRow key="jlpt" label="JLPT level">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="Any level" active={minJlptLevel === 'any'} onClick={() => setMinJlptLevel('any')} />
            <ChipSelector
              options={JLPT_CHIP_OPTIONS}
              value={minJlptLevel}
              onChange={setMinJlptLevel}
              mode="threshold"
              thresholdDirection="forward"
            />
          </div>
        </FilterRow>
        <FilterRow key="filter" label="Filter">
          <ChipSelector mode="multi" options={filterOptions} value={filterValue} onChange={handleFilterChange} />
        </FilterRow>
      </FilterCard>

      <DataList
        columns={WORD_COLUMNS}
        rows={displayedRows}
        selection={{ selected, onToggle: toggleRow, bulkHeader: { selectFirst: true } }}
        search={{ value: lookupQuery, onChange: setLookupQuery, placeholder: 'Look up a word from this episode...' }}
        emptyMessage={
          lookupQuery.trim()
            ? <>No match in this episode — try <a href="#/dictionary" style={{ color: ACCENT }}>the full dictionary search</a>.</>
            : 'No words match these filters.'
        }
        maxWidth="100%"
      />

      <ActionBar>
        <Button variant="primary" size="xl" onClick={handleStartDrill} disabled={selected.size === 0}>
          Start Drill ({selected.size})
        </Button>
      </ActionBar>
    </div>
  )
}
