import { Component, useMemo, useRef, useState } from 'react'
import Badge from './Badge.jsx'
import DataList from './DataList.jsx'
import Japanese from './Japanese.jsx'
import Modal from './Modal.jsx'
import SectionHeader from './SectionHeader.jsx'
import { useAccent } from '../context/ModuleThemeContext.jsx'
import { useDictionaryEntries } from '../hooks/useDictionaryEntries.js'
import { useSentencesForWords } from '../hooks/useSentenceForWord.js'
import { supabase } from '../lib/supabase.js'
import { resolveWordDisplay, shortPos } from '../utils/wordDisplay.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_ENTRY_WORD, KANJI_FONT, DANGER } from '../data/theme.js'

// Renders one or more pre-grouped word lists — kanji breakdown, sentence,
// dictionary link per row, expandable — with no opinion about drilling,
// picking, or which page it's on. Extracted from VocabPage's old
// GlanceScreen (full-page, VocabPage-only) so Dictionary's "View words"
// can show the exact same rich preview in its own modal without a page
// navigation, and VocabPage's WordExplorerModal Words step can render the
// same content it always has. `groups` is `[{ id, label, words }]`,
// already resolved and ordered by the caller — this component only
// renders them.
export function WordListContent({ groups, sentenceSource = 'custom' }) {
  const allWords = useMemo(() => groups.flatMap(g => g.words), [groups])
  const jmdictIds = useMemo(() => allWords.map(w => w.jmdictId).filter(Boolean), [allWords])
  const { entries: dictEntries } = useDictionaryEntries(jmdictIds, true)
  const tanakaSentences = useSentencesForWords(jmdictIds, true)
  const ACCENT = useAccent()
  const [expandedId, setExpandedId] = useState(null)
  const [expandedKanji, setExpandedKanji] = useState([])
  const kanjiCache = useRef({})
  const expandedSet = useMemo(() => new Set(expandedId ? [expandedId] : []), [expandedId])

  async function handleToggleRow(word) {
    const next = expandedId === word.id ? null : word.id
    setExpandedId(next)
    setExpandedKanji([])
    if (!next) return

    const { displayForm } = resolveWordDisplay(word, dictEntries[word.jmdictId])
    const chars = (displayForm ?? '').split('').filter(ch => /\p{Script=Han}/u.test(ch))
    const missing = chars.filter(ch => !kanjiCache.current[ch])
    if (missing.length > 0 && supabase) {
      const { data } = await supabase
        .from('kanji')
        .select('literal, on_readings, kun_readings, meanings, jlpt, grade, stroke_count')
        .in('literal', missing)
      if (data) {
        for (const k of data) kanjiCache.current[k.literal] = k
      }
    }
    setExpandedKanji(chars.map(ch => kanjiCache.current[ch]).filter(Boolean))
  }

  function renderWordRow(word) {
    const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
    const { displayForm, reading } = resolveWordDisplay(word, dictEntry)
    const posLabel = shortPos(Array.isArray(dictEntry?.pos) ? dictEntry.pos[0] : null)
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
          <Japanese as="span" style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{displayForm}</Japanese>
          {reading && <Japanese as="span" style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{reading}</Japanese>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {posLabel && <Badge variant="fill" tone="neutral">{posLabel}</Badge>}
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {dictEntry?.gloss_en?.split('; ').slice(0, 2).join('; ') ?? word.english}
          </span>
        </div>
      </div>
    )
  }

  function renderWordDetail(word) {
    const dictEntry = word.jmdictId ? dictEntries[word.jmdictId] : null
    const tanakaSentence = word.jmdictId ? tanakaSentences[word.jmdictId] : null
    const useTanakaSentence = sentenceSource === 'tanaka' ? !!tanakaSentence : (!word.sentence && !!tanakaSentence)
    const sentenceText = useTanakaSentence ? tanakaSentence.japanese : word.sentence
    const { displayForm } = resolveWordDisplay(word, dictEntry)
    const kanjiChars = (displayForm ?? '').split('').filter(ch => /\p{Script=Han}/u.test(ch))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kanjiChars.length > 0 && (
          expandedKanji.length > 0 ? (
            expandedKanji.map(k => (
              // Inner surface inside an already-raised list — lighter than Card
              // on purpose so it reads as nested, not as a second card.
              <div key={k.literal} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <Japanese as="div" style={{ fontSize: '2rem', color: TEXT, minWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>{k.literal}</Japanese>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {k.on_readings?.length > 0 && <Japanese as="div" style={{ fontSize: FS_BASE, color: TEXT, marginBottom: 2 }}>{k.on_readings.join('　')}</Japanese>}
                  {k.kun_readings?.length > 0 && <Japanese as="div" style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 4 }}>{k.kun_readings.join('　')}</Japanese>}
                  <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{(k.meanings ?? '').split('; ').slice(0, 4).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {k.jlpt != null && <Badge tone="accent">N{k.jlpt}</Badge>}
                  {k.stroke_count != null && <Badge variant="text" tone="neutral">{k.stroke_count} strokes</Badge>}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, padding: '6px 0' }}>Loading…</div>
          )
        )}
        {sentenceText && (
          <Japanese as="div" style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontStyle: 'italic', padding: '2px 0' }}>{sentenceText}</Japanese>
        )}
        {dictEntry && (
          <a
            href={`#/dictionary/entry/${dictEntry.id}`}
            className="srs-browse-link"
            style={{ fontSize: FS_CAPTION, color: ACCENT, alignSelf: 'flex-start', marginTop: 2 }}
          >
            View full entry →
          </a>
        )}
      </div>
    )
  }

  const columns = [{ key: 'word', render: renderWordRow, wrap: true }]

  return (
    <div style={{ width: '100%' }}>
      {groups.filter(g => g.words.length > 0).map(group => (
        <div key={group.id} style={{ marginBottom: 40 }}>
          <SectionHeader title={group.label} />
          <DataList
            columns={columns}
            rows={group.words}
            rowKey={w => w.id}
            expand={{ expanded: expandedSet, onToggle: id => handleToggleRow(group.words.find(w => w.id === id)), render: renderWordDetail }}
            padding="12px 16px"
            maxWidth="100%"
          />
        </div>
      ))}
    </div>
  )
}

export class WordListErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: DANGER, fontFamily: FONT, fontSize: FS_BASE }}>
          Preview error: {this.state.error.message}
          <pre style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED, whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

// The Modal-wrapped form — for a caller (Dictionary) that doesn't already
// have its own Modal chrome around this content. VocabPage's
// WordExplorerModal composes WordListContent directly instead, inside a
// Modal it already owns (its Words step shares that Modal with a Picker
// step, so the two can't be two separate Modal instances).
export default function WordListModal({ open, onClose, title = 'View words', size = 'xl', isMobile, groups, sentenceSource, footer }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size} isMobile={isMobile} footer={footer}>
      <WordListErrorBoundary>
        <WordListContent groups={groups} sentenceSource={sentenceSource} />
      </WordListErrorBoundary>
    </Modal>
  )
}
