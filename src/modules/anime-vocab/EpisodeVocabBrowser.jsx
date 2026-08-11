import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { syncEpisodeVocab } from './api.js'
import { useDictionaryEntries } from '../../hooks/useDictionaryEntries.js'
import { briefGloss } from '../../utils/dictionaryEntryLookup.js'
import { useProgress } from '../../hooks/useProgress.js'
import { migrateProgress } from '../vocab-srs/migrate.js'
import { buildJmdictIdCardIndex, resolveStatus } from './srsStatusResolver.js'
import DrawerSelect from '../../components/DrawerSelect.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'
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

function checkboxRow(label, checked, onChange) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: ACCENT }} />
      {label}
    </label>
  )
}

export default function EpisodeVocabBrowser({ media, episode, onStartDrill }) {
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  const [excludeGrammar, setExcludeGrammar] = useState(true)
  const [excludeNames, setExcludeNames] = useState(true)
  const [excludeGeneric, setExcludeGeneric] = useState(true)
  const [minJlptLevel, setMinJlptLevel] = useState('any')
  const [excludeKnown, setExcludeKnown] = useState(false)
  const [wordLimit, setWordLimit] = useState(DEFAULT_WORD_LIMIT)
  const [lookupQuery, setLookupQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false)

  const { data: srsData } = useProgress('vocab-srs')
  const cardIndex = useMemo(() => buildJmdictIdCardIndex(migrateProgress(srsData)), [srsData])

  const jmdictIds = useMemo(() => occurrences.map(o => o.jmdict_id).filter(Boolean), [occurrences])
  const dictEntries = useDictionaryEntries(jmdictIds, true)

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

  const eligible = useMemo(() =>
    rows
      .filter(r => r.jmdict_id)
      .filter(r => !excludeGrammar || !r.is_grammar)
      .filter(r => !excludeNames || !r.is_name)
      .filter(r => !excludeGeneric || r.global_frequency_rank == null || r.global_frequency_rank > GENERIC_RANK_THRESHOLD)
      .filter(r => minJlptLevel === 'any' || r.jlptLevel == null || JLPT_LEVEL_ORDER[r.jlptLevel] >= JLPT_LEVEL_ORDER[minJlptLevel])
      .filter(r => !excludeKnown || (r.status !== 'young' && r.status !== 'mature'))
      .sort((a, b) => (a.frequency_rank ?? 0) - (b.frequency_rank ?? 0)),
    [rows, excludeGrammar, excludeNames, excludeGeneric, minJlptLevel, excludeKnown]
  )

  // Auto-select the top N eligible words whenever filters/limit change, unless
  // the user has hand-picked their own selection this session.
  useEffect(() => {
    if (manuallyAdjusted) return
    setSelected(new Set(eligible.slice(0, wordLimit).map(r => r.id)))
  }, [eligible, wordLimit, manuallyAdjusted])

  const displayedRows = useMemo(() => {
    const q = lookupQuery.trim()
    if (!q) return eligible
    return rows.filter(r =>
      r.displayForm?.includes(q) || r.reading?.includes(q) || r.surface_form?.includes(q) || r.gloss?.toLowerCase().includes(q.toLowerCase())
    )
  }, [rows, eligible, lookupQuery])

  function toggleRow(id) {
    setManuallyAdjusted(true)
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
      <div style={{ maxWidth: 640, margin: '0 auto', fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
        {syncing ? 'Fetching vocabulary from Jiten.moe (first view of this episode)...' : 'Loading...'}
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

      <input
        type="text"
        value={lookupQuery}
        onChange={e => setLookupQuery(e.target.value)}
        placeholder="Look up a word from this episode..."
        style={{
          width: '100%', padding: '10px 14px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: 'normal',
          background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: TEXT, outline: 'none',
        }}
      />
      {lookupQuery.trim() && displayedRows.length === 0 && (
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          No match in this episode — try <a href="#/dictionary" style={{ color: ACCENT }}>the full dictionary search</a>.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 16px' }}>
        {checkboxRow('Exclude grammar words', excludeGrammar, () => setExcludeGrammar(v => !v))}
        {checkboxRow('Exclude names', excludeNames, () => setExcludeNames(v => !v))}
        {checkboxRow('Exclude very common words', excludeGeneric, () => setExcludeGeneric(v => !v))}
        {checkboxRow('Exclude already-known', excludeKnown, () => setExcludeKnown(v => !v))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>JLPT level</span>
          <DrawerSelect label="Minimum JLPT level" value={minJlptLevel} onChange={setMinJlptLevel} options={JLPT_LEVEL_OPTIONS} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
          Words to drill
          <input
            type="number"
            min={1}
            max={100}
            value={wordLimit}
            onChange={e => { setManuallyAdjusted(false); setWordLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1))) }}
            style={{ width: 56, padding: '4px 8px', fontFamily: FONT, background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: TEXT }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.08em' }}>{selected.size} SELECTED</span>
        <button
          onClick={handleStartDrill}
          disabled={selected.size === 0}
          style={{
            padding: '10px 24px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, borderRadius: 8,
            cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            background: selected.size > 0 ? ACCENT : 'rgba(255,255,255,0.05)',
            color: selected.size > 0 ? '#fff' : 'rgba(255,255,255,0.3)',
            border: 'none',
          }}
        >
          Start Drill ({selected.size})
        </button>
      </div>

      <div style={{ background: '#2A2A2A', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {displayedRows.map(row => (
          <label
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontFamily: FONT, letterSpacing: TRACKING,
            }}
          >
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} style={{ flexShrink: 0, width: 16, height: 16, accentColor: ACCENT }} />
            <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0, flexShrink: 0, minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.displayForm}
            </span>
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0, flexShrink: 0, minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.reading && row.reading !== row.displayForm ? row.reading : ''}
            </span>
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.gloss ?? (row.jmdict_id ? '' : '(no dictionary match)')}
            </span>
            {row.jlptLevel && (
              <span
                style={{ fontSize: FS_BADGE, color: '#3ABDA4', fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0, opacity: row.jlptLevelInferred ? 0.55 : 1 }}
                title={row.jlptLevelInferred ? 'Approximate — inferred from a related word, not directly sourced' : undefined}
              >
                {row.jlptLevelInferred ? `~${row.jlptLevel}` : row.jlptLevel}
              </span>
            )}
            {row.is_grammar && <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>grammar</span>}
            {row.is_name && <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>name</span>}
            {STATUS_LABEL[row.status] && (
              <span style={{ fontSize: FS_BADGE, color: STATUS_COLOR[row.status], fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>{STATUS_LABEL[row.status]}</span>
            )}
            <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
              {row.occurrence_count ?? ''}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
