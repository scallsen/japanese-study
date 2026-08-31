import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { syncEpisodeVocab } from './api.js'
import { useDictionaryEntries } from '../../hooks/useDictionaryEntries.js'
import { briefGloss } from '../../utils/dictionaryEntryLookup.js'
import { useProgress } from '../../hooks/useProgress.js'
import { migrateProgress } from '../vocab-srs/migrate.js'
import { buildJmdictIdCardIndex, resolveStatus } from './srsStatusResolver.js'
import Select from '../../components/Select.jsx'
import NumberField from '../../components/NumberField.jsx'
import Button from '../../components/Button.jsx'
import TextInput from '../../components/TextInput.jsx'
import DataList from '../../components/DataList.jsx'
import Badge from '../../components/Badge.jsx'
import CenteredLoadingMessage from '../../components/CenteredLoadingMessage.jsx'
import { useDelayedLoading } from '../../hooks/useDelayedLoading.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION, FS_LIST_TITLE } from '../../data/theme.js'
import { useAccent } from '../../context/ModuleThemeContext.jsx'

const DEFAULT_WORD_LIMIT = 20
const KANJI_FONT = "'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif"
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
const JLPT_LEVEL_OPTIONS = [
  { value: 'any', label: 'Any level' },
  { value: 'N4', label: 'N4 and above' },
  { value: 'N3', label: 'N3 and above' },
  { value: 'N2', label: 'N2 and above' },
  { value: 'N1', label: 'N1 only' },
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

function checkboxRow(label, checked, onChange, accent) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: accent }} />
      {label}
    </label>
  )
}

// Native checkboxes don't expose an "indeterminate" prop — it can only be set
// as a DOM property, hence the ref + effect instead of a plain <input>.
function SelectAllCheckbox({ checked, indeterminate, onChange }) {
  const ACCENT = useAccent()
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ flexShrink: 0, width: 16, height: 16, accentColor: ACCENT }}
    />
  )
}

function CaretButton({ open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Collapse bulk select' : 'Expand bulk select'}
      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
    >
      <span style={{
        color: TEXT_MUTED, fontSize: '1.1rem', display: 'inline-block',
        transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
      }}>
        ›
      </span>
    </button>
  )
}

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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCountInput, setBulkCountInput] = useState(String(DEFAULT_WORD_LIMIT))

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

  const allEligibleSelected = eligible.length > 0 && eligible.every(r => selected.has(r.id))
  const someEligibleSelected = eligible.some(r => selected.has(r.id))

  function toggleSelectAll() {
    setSelectionTouched(true)
    setSelected(allEligibleSelected ? new Set() : new Set(eligible.map(r => r.id)))
  }

  function toggleBulkOpen() {
    setBulkOpen(open => {
      if (!open) setBulkCountInput(String(Math.max(1, selected.size || DEFAULT_WORD_LIMIT)))
      return !open
    })
  }

  function handleCancelBulk() {
    setBulkOpen(false)
  }

  function handleConfirmBulk() {
    const n = Math.max(1, Math.min(Number(bulkCountInput) || 1, eligible.length || 1))
    setSelectionTouched(true)
    setSelected(new Set(eligible.slice(0, n).map(r => r.id)))
    setBulkOpen(false)
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>Minimum JLPT level</span>
          <Select label="Minimum JLPT level" value={minJlptLevel} onChange={setMinJlptLevel} options={JLPT_LEVEL_OPTIONS} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <div style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Filter words
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {checkboxRow(`Grammar words (${grammarCount})`, includeGrammar, () => setIncludeGrammar(v => !v), ACCENT)}
            {checkboxRow(`Names (${namesCount})`, includeNames, () => setIncludeNames(v => !v), ACCENT)}
            {checkboxRow(`Very common words (${genericCount})`, includeGeneric, () => setIncludeGeneric(v => !v), ACCENT)}
            {checkboxRow(`Known (${knownCount})`, includeKnown, () => setIncludeKnown(v => !v), ACCENT)}
          </div>
        </div>
      </div>

      <div style={{ background: '#2A2A2A', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <TextInput value={lookupQuery} onChange={setLookupQuery} placeholder="Look up a word from this episode..." variant="bare" />
        </div>
        {lookupQuery.trim() && displayedRows.length === 0 ? (
          <div style={{ padding: '10px 14px', fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            No match in this episode — try <a href="#/dictionary" style={{ color: ACCENT }}>the full dictionary search</a>.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <SelectAllCheckbox checked={allEligibleSelected} indeterminate={!allEligibleSelected && someEligibleSelected} onChange={toggleSelectAll} />
            <CaretButton open={bulkOpen} onClick={toggleBulkOpen} />
            {!bulkOpen ? (
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                {selected.size} of {eligible.length} selected
              </span>
            ) : (
              <>
                <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>Select first</span>
                <NumberField
                  value={Number(bulkCountInput) || ''}
                  onChange={v => setBulkCountInput(String(v))}
                  min={1}
                  max={Math.max(eligible.length, 1)}
                  width={56}
                />
                <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>words</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Button variant="neutral" onClick={handleCancelBulk}>Cancel</Button>
                  <Button variant="primary" onClick={handleConfirmBulk}>Confirm</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {displayedRows.length > 0 && (
        <DataList
          columns={WORD_COLUMNS}
          rows={displayedRows}
          selection={{ selected, onToggle: toggleRow }}
          maxWidth="100%"
        />
      )}

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
        background: '#1E1E1E', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="lg" onClick={handleStartDrill} disabled={selected.size === 0}>
            Start Drill ({selected.size})
          </Button>
        </div>
      </div>
    </div>
  )
}
