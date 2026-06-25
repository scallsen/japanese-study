import { useState, useEffect, useRef, useMemo } from 'react'
import { toKana } from 'wanakana'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import { supabase } from '../lib/supabase.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_NAV, FS_BADGE, FS_CAPTION, FS_ENTRY_KANJI, FS_ENTRY_WORD, FS_CONTENT_HEADING } from '../data/theme.js'

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const SURFACE_HOVER = '#313131'

const PAGE_SIZE = 20

function isJapanese(str) {
  return /[぀-鿿]/.test(str)
}

function isKanaOnly(str) {
  return /^[ぁ-ヿ]+$/.test(str)
}

// Returns the kana form if term is pure romaji that fully converts; null otherwise.
function romajiToKana(term) {
  if (!term || isJapanese(term) || !/^[a-zA-Z'-]+$/.test(term)) return null
  const converted = toKana(term)
  return /^[ぁ-ヿ]+$/.test(converted) ? converted : null
}

function relevanceScore(row, term, effectiveTerm) {
  const eff = effectiveTerm ?? term
  let score = row.common ? 100 : 0
  if (row.primary_form === term || row.primary_form === eff) score += 80
  if (row.kana_forms?.includes(eff)) score += 60
  if (row.primary_form.startsWith(eff) || row.primary_form.startsWith(term)) score += 25
  const glosses = row.gloss_en?.split('; ') ?? []
  const lowerTerm = term.toLowerCase()
  const firstGloss = glosses[0]?.toLowerCase() ?? ''
  if (firstGloss === lowerTerm) score += 40
  else if (glosses.some(g => g.toLowerCase() === lowerTerm)) score += 30
  else if (firstGloss.startsWith(lowerTerm)) score += 20
  score -= Math.min(row.primary_form.length, 20)
  return score
}

function shortPos(raw) {
  if (!raw) return null
  if (raw.startsWith('Godan verb')) return 'v5'
  if (raw.startsWith('Ichidan verb')) return 'v1'
  if (raw.startsWith('suru verb')) return 'vs'
  if (raw.startsWith('adjectival nouns') || raw.startsWith('quasi-adj')) return 'adj-na'
  if (raw.startsWith('adjective')) return 'adj-i'
  if (raw.startsWith('adverb')) return 'adv'
  if (raw.startsWith('noun')) return 'noun'
  if (raw.startsWith('expression')) return 'exp'
  if (raw.startsWith('conjunction')) return 'conj'
  if (raw.startsWith('interjection')) return 'int'
  if (raw.startsWith('auxiliary')) return 'aux'
  if (raw.startsWith('particle')) return 'part'
  if (raw.startsWith('prefix')) return 'pfx'
  if (raw.startsWith('suffix')) return 'sfx'
  if (raw.startsWith('pronoun')) return 'pron'
  if (raw.startsWith('counter')) return 'ctr'
  if (raw.startsWith('numeric')) return 'num'
  return raw.split(' ')[0].slice(0, 6).toLowerCase()
}

function katakanaToHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function isSingleKanji(str) {
  return /^[一-鿿]$/.test(str)
}

async function doKanjiSearch(term) {
  if (!supabase) return []
  const trimmed = term.trim()
  if (!trimmed) return []

  const kanaForm = romajiToKana(trimmed)
  const effectiveTerm = kanaForm ?? trimmed
  const jp = isJapanese(effectiveTerm) || !!kanaForm

  let q = supabase
    .from('kanji')
    .select('literal, on_readings, kun_readings, meanings, jlpt, grade, stroke_count, frequency')
    .limit(8)

  if (isSingleKanji(trimmed)) {
    q = q.eq('literal', trimmed)
  } else if (jp && isKanaOnly(effectiveTerm)) {
    const hiragana = katakanaToHiragana(effectiveTerm)
    q = q.filter('readings_hira', 'cs', `{${hiragana}}`).order('frequency', { ascending: true, nullsFirst: false })
  } else if (!jp) {
    q = q.ilike('meanings', `%${trimmed}%`).order('frequency', { ascending: true, nullsFirst: false })
  } else {
    return []
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function doSearch(term, offset, commonOnly) {
  if (!supabase) throw new Error('Supabase is not configured (missing env vars)')
  const trimmed = term.trim()
  if (!trimmed) return { rows: [], hasMore: false }

  // Convert romaji to kana if the input fully maps (e.g. "hon" → "ほん")
  const kanaForm = romajiToKana(trimmed)
  const effectiveTerm = kanaForm ?? trimmed

  const jp = isJapanese(effectiveTerm) || !!kanaForm

  const buildBase = () => {
    let q = supabase
      .from('dictionary')
      .select('id, primary_form, kana_forms, gloss_en, pos, common')
      .order('common', { ascending: false })
    if (commonOnly) q = q.eq('common', true)
    return q
  }

  if (isJapanese(trimmed) && offset === 0) {
    // User typed Japanese directly — two-query merge: prefix + kana_forms containment
    const [r1, r2] = await Promise.all([
      buildBase().ilike('primary_form', effectiveTerm + '%').limit(PAGE_SIZE),
      buildBase().filter('kana_forms', 'cs', `{${effectiveTerm}}`).limit(PAGE_SIZE),
    ])
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
    const seen = new Set()
    const merged = []
    for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }
    merged.sort((a, b) => relevanceScore(b, trimmed, effectiveTerm) - relevanceScore(a, trimmed, effectiveTerm))
    const rows = merged.slice(0, PAGE_SIZE)
    return { rows, hasMore: rows.length === PAGE_SIZE }
  }

  if (kanaForm && offset === 0) {
    // Romaji: kana readings + 3 word-boundary English gloss queries (first, middle, last).
    // Word-boundary patterns prevent "car" from matching "carriage", "carpet", etc.
    const [r1, r2, r3, r4] = await Promise.all([
      buildBase().filter('kana_forms', 'cs', `{${kanaForm}}`).limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', trimmed + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + trimmed + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + trimmed).limit(PAGE_SIZE),
    ])
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
    if (r3.error) throw r3.error
    if (r4.error) throw r4.error
    const seen = new Set()
    const merged = []
    for (const row of [...(r1.data ?? []), ...(r2.data ?? []), ...(r3.data ?? []), ...(r4.data ?? [])]) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }
    merged.sort((a, b) => relevanceScore(b, trimmed, kanaForm) - relevanceScore(a, trimmed, kanaForm))
    const rows = merged.slice(0, PAGE_SIZE)
    return { rows, hasMore: rows.length === PAGE_SIZE }
  }

  if (!jp && offset === 0) {
    // Pure English: 3 word-boundary gloss queries — first, middle, last position.
    const [r1, r2, r3] = await Promise.all([
      buildBase().ilike('gloss_en', effectiveTerm + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + effectiveTerm + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + effectiveTerm).limit(PAGE_SIZE),
    ])
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
    if (r3.error) throw r3.error
    const seen = new Set()
    const merged = []
    for (const row of [...(r1.data ?? []), ...(r2.data ?? []), ...(r3.data ?? [])]) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
    }
    merged.sort((a, b) => relevanceScore(b, trimmed, effectiveTerm) - relevanceScore(a, trimmed, effectiveTerm))
    const rows = merged.slice(0, PAGE_SIZE)
    return { rows, hasMore: rows.length === PAGE_SIZE }
  }

  // Pagination (offset > 0) — DB ordering only
  let q = buildBase().range(offset, offset + PAGE_SIZE - 1)
  if (jp) {
    q = q.ilike('primary_form', effectiveTerm + '%')
  } else {
    q = q.ilike('gloss_en', '%' + effectiveTerm + '%')
  }

  const { data, error } = await q
  if (error) throw error
  return { rows: data ?? [], hasMore: (data ?? []).length === PAGE_SIZE }
}

function KanjiRow({ entry }) {
  const jlptLabel = entry.jlpt ? `N${entry.jlpt}` : null
  const gradeLabel = entry.grade && entry.grade <= 6 ? `G${entry.grade}` : null

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <span style={{ fontSize: FS_ENTRY_KANJI, color: TEXT, fontFamily: FONT, lineHeight: 1, flexShrink: 0, letterSpacing: 0, minWidth: 40, textAlign: 'center' }}>
        {entry.literal}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
          {entry.on_readings.length > 0 && (
            <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
              {entry.on_readings.join('、')}
            </span>
          )}
          {entry.kun_readings.length > 0 && (
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {entry.kun_readings.join('、')}
            </span>
          )}
          {jlptLabel && (
            <span style={{ fontSize: FS_BADGE, color: '#3ABDA4', fontFamily: FONT, letterSpacing: TRACKING }}>{jlptLabel}</span>
          )}
          {gradeLabel && !jlptLabel && (
            <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>{gradeLabel}</span>
          )}
          {entry.stroke_count && (
            <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.6 }}>
              {entry.stroke_count} strokes
            </span>
          )}
        </div>
        {entry.meanings && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {entry.meanings.split('; ').slice(0, 4).join('; ')}
          </span>
        )}
      </div>
    </div>
  )
}

function KanjiSection({ entries, hasWords }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [collapseHovered, setCollapseHovered] = useState(false)

  return (
    <>
      <SectionLabel label="Kanji" />
      <div style={{
        background: SURFACE,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: expanded ? 'hidden' : 'visible',
        marginBottom: hasWords ? 20 : 0,
      }}>
        {!expanded ? (
          <div
            onClick={() => setExpanded(true)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              background: hovered ? SURFACE_HOVER : 'transparent',
              borderRadius: 8,
              transition: 'background 100ms',
            }}
          >
            <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
              {entries.map((entry) => (
                <div
                  key={entry.literal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 20px',
                    flexShrink: 0,
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, fontFamily: FONT, letterSpacing: 0 }}>
                    {entry.literal}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 16px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: FS_ENTRY_WORD, lineHeight: 1, color: TEXT_MUTED, opacity: 0.5, fontFamily: 'system-ui' }}>›</span>
            </div>
          </div>
        ) : (
          <>
            {entries.map(entry => <KanjiRow key={entry.literal} entry={entry} />)}
            <div
              onClick={() => setExpanded(false)}
              onMouseEnter={() => setCollapseHovered(true)}
              onMouseLeave={() => setCollapseHovered(false)}
              style={{
                padding: '10px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: FS_CAPTION,
                color: TEXT_MUTED,
                fontFamily: FONT,
                letterSpacing: TRACKING,
                opacity: 0.6,
                borderTop: '1px solid rgba(255,255,255,0.05)',
                background: collapseHovered ? SURFACE_HOVER : 'transparent',
                transition: 'background 100ms',
              }}
            >
              Collapse Kanji
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      marginTop: 4,
    }}>
      <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.1em', opacity: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function EntryRow({ entry }) {
  const kana = entry.kana_forms?.[0]
  const showKana = kana && kana !== entry.primary_form
  const posLabel = shortPos(Array.isArray(entry.pos) ? entry.pos[0] : null)
  const meaning = entry.gloss_en?.split('; ').slice(0, 3).join('; ') ?? ''

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
        <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: FONT, letterSpacing: 0 }}>{entry.primary_form}</span>
        {showKana && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>{kana}</span>
        )}
        {entry.common && (
          <span style={{ fontSize: FS_BADGE, color: '#3ABDA4', fontFamily: FONT, letterSpacing: TRACKING }}>common</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {posLabel && (
          <span style={{
            fontSize: FS_BADGE,
            color: TEXT_MUTED,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 3,
            padding: '1px 6px',
            fontFamily: FONT,
            letterSpacing: TRACKING,
            flexShrink: 0,
          }}>{posLabel}</span>
        )}
        {meaning && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>{meaning}</span>
        )}
      </div>
    </div>
  )
}

export default function DictionaryPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [kanjiResults, setKanjiResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [commonOnly, setCommonOnly] = useState(false)
  const [error, setError] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const debounceRef = useRef(null)
  const ticketRef = useRef(0)
  const romajiHint = useMemo(() => romajiToKana(query.trim()), [query])

  async function runSearch(term, off, append, common) {
    if (!term.trim()) {
      setResults([])
      setKanjiResults([])
      setHasMore(false)
      setOffset(0)
      return
    }
    const ticket = ++ticketRef.current
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const [{ rows, hasMore: more }, kanji] = await Promise.all([
        doSearch(term, off, common),
        append ? Promise.resolve(null) : doKanjiSearch(term),
      ])
      if (ticket !== ticketRef.current) return
      setResults(prev => append ? [...prev, ...rows] : rows)
      setHasMore(more)
      setOffset(off + rows.length)
      if (!append) setKanjiResults(kanji ?? [])
    } catch {
      if (ticket !== ticketRef.current) return
      setError('Search failed. Please try again.')
    } finally {
      if (ticket === ticketRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setKanjiResults([])
      setHasMore(false)
      setOffset(0)
      return
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query, 0, false, commonOnly)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, commonOnly])

  const showEmpty = !loading && !error && query && results.length === 0 && kanjiResults.length === 0
  const showPrompt = !query
  const showResults = results.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BG }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Dictionary' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <input
            type="text"
            placeholder="Search Japanese or English..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: SURFACE,
              border: `1px solid ${inputFocused ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: FS_NAV,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              color: TEXT,
              outline: 'none',
              marginBottom: romajiHint ? 6 : 12,
              transition: 'border-color 100ms',
            }}
          />

          {romajiHint && (
            <div style={{
              fontSize: FS_CAPTION,
              color: TEXT_MUTED,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              marginBottom: 12,
              opacity: 0.6,
            }}>
              Searching as {romajiHint}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={commonOnly}
                onChange={e => setCommonOnly(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#3ABDA4' }}
              />
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                Common words only
              </span>
            </label>
            {showResults && (
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginLeft: 'auto', opacity: 0.55 }}>
                {results.length}{hasMore ? '+' : ''} results
              </span>
            )}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
              Searching...
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#E05A4E', fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
              {error}
            </div>
          )}

          {!loading && showEmpty && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && showPrompt && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING, opacity: 0.5 }}>
              217,625 entries · JMdict
            </div>
          )}

          {!loading && kanjiResults.length > 0 && (
            <KanjiSection
              key={kanjiResults.map(r => r.literal).join('')}
              entries={kanjiResults}
              hasWords={showResults}
            />
          )}

          {showResults && !loading && (
            <>
              {kanjiResults.length > 0 && <SectionLabel label="Words" />}
              <div style={{
                background: SURFACE,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {results.map(entry => <EntryRow key={entry.id} entry={entry} />)}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    onClick={() => runSearch(query, offset, true, commonOnly)}
                    disabled={loadingMore}
                    style={{
                      fontSize: FS_BASE,
                      fontFamily: FONT,
                      letterSpacing: TRACKING,
                      color: TEXT_MUTED,
                      background: SURFACE,
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      padding: '8px 28px',
                      cursor: loadingMore ? 'default' : 'pointer',
                      opacity: loadingMore ? 0.5 : 1,
                    }}
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
