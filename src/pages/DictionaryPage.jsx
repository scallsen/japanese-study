import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { toKana } from 'wanakana'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import TopProgressBar from '../components/TopProgressBar.jsx'
import CenteredLoadingMessage from '../components/CenteredLoadingMessage.jsx'
import { useDelayedLoading } from '../hooks/useDelayedLoading.js'
import { supabase } from '../lib/supabase.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_ENTRY_WORD, FS_CONTENT_HEADING, KANJI_FONT } from '../data/theme.js'
import AttributionFooter from '../components/AttributionFooter.jsx'
import Badge from '../components/Badge.jsx'
import Card from '../components/Card.jsx'
import TextInput from '../components/TextInput.jsx'
import Checkbox from '../components/Checkbox.jsx'
import Button from '../components/Button.jsx'
import DataList from '../components/DataList.jsx'
import { MODULES } from '../data/modules.js'
import { ModuleThemeProvider, useAccent } from '../context/ModuleThemeContext.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import { KanjiBreakdownEntry } from './dictionaryShared.jsx'

const BG = '#1E1E1E'
const DICTIONARY_ACCENT = MODULES.find(m => m.id === 'dictionary').accent

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
  const kata = hiraganaToKatakana(eff)
  let score = row.common ? 100 : 0
  if (row.primary_form === term || row.primary_form === eff || row.primary_form === kata) score += 80
  if (row.kana_forms?.includes(eff) || row.kana_forms?.includes(kata)) score += 60
  if (row.primary_form.startsWith(eff) || row.primary_form.startsWith(term) || row.primary_form.startsWith(kata)) score += 25
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

function hiraganaToKatakana(str) {
  return str.replace(/[ぁ-ん]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
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

  const kanaForm = romajiToKana(trimmed)
  const effectiveTerm = kanaForm ?? trimmed
  const jp = isJapanese(effectiveTerm) || !!kanaForm
  // When romaji converts to hiragana, also search the katakana equivalent (e.g. terebi → てれび → テレビ)
  const katakanaForm = kanaForm ? hiraganaToKatakana(kanaForm) : null

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
    // Romaji → kana: kana_forms exact match + katakana primary_form prefix + English gloss word-boundary queries
    const queries = [
      buildBase().filter('kana_forms', 'cs', `{${kanaForm}}`).limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', trimmed + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + trimmed + '; %').limit(PAGE_SIZE),
      buildBase().ilike('gloss_en', '%; ' + trimmed).limit(PAGE_SIZE),
    ]
    if (katakanaForm) {
      queries.push(buildBase().ilike('primary_form', katakanaForm + '%').limit(PAGE_SIZE))
    }
    const results = await Promise.all(queries)
    if (results[0].error) throw results[0].error
    const seen = new Set()
    const merged = []
    for (const { data } of results) {
      for (const row of (data ?? [])) {
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
      }
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
    const prefix = katakanaForm
      ? `primary_form.ilike.${effectiveTerm}%,primary_form.ilike.${katakanaForm}%`
      : null
    q = prefix ? q.or(prefix) : q.ilike('primary_form', effectiveTerm + '%')
  } else {
    q = q.ilike('gloss_en', '%' + effectiveTerm + '%')
  }

  const { data, error } = await q
  if (error) throw error
  return { rows: data ?? [], hasMore: (data ?? []).length === PAGE_SIZE }
}

function KanjiRow({ entry }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <KanjiBreakdownEntry entry={entry} truncateMeanings />
    </div>
  )
}

function KanjiSection({ entries, hasWords }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <SectionHeader title="Kanji" />
      <Card padding={0} style={{ overflow: expanded ? 'hidden' : 'visible', marginBottom: hasWords ? 20 : 0 }}>
        {!expanded ? (
          <div
            onClick={() => setExpanded(true)}
            className="kanji-section-toggle"
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
              {entries.map(entry => (
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
                  <span style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>
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
              className="kanji-section-collapse"
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
              }}
            >
              Collapse Kanji
            </div>
          </>
        )}
      </Card>
    </>
  )
}

// Content-only — DataList's Cell wraps this; the row's own <a> and
// hover/divider treatment come from DataList itself (navigate.href below).
function entryRowContent(entry) {
  const kana = entry.kana_forms?.[0]
  const showKana = kana && kana !== entry.primary_form
  const posLabel = shortPos(Array.isArray(entry.pos) ? entry.pos[0] : null)
  const meaning = entry.gloss_en?.split('; ').slice(0, 3).join('; ') ?? ''

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
        <span style={{ fontSize: FS_ENTRY_WORD, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{entry.primary_form}</span>
        {showKana && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>{kana}</span>
        )}
        {entry.common && <Badge variant="text" tone="accent">common</Badge>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {posLabel && <Badge variant="fill" tone="neutral">{posLabel}</Badge>}
        {meaning && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>{meaning}</span>
        )}
      </div>
    </div>
  )
}

const ENTRY_ROW_COLUMNS = [{ key: 'content', render: entryRowContent, wrap: true }]

const SESSION_KEY = 'dict-search-state'

function loadSaved() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}

export default function DictionaryPage() {
  // Explicit override, not ambient useAccent() — this component is the one
  // establishing ModuleThemeProvider below, so it can't read back the value
  // it's about to provide to its own children.
  const ACCENT = useAccent(DICTIONARY_ACCENT)
  const saved = useMemo(loadSaved, [])
  const [query, setQuery] = useState(saved?.query ?? '')
  const [results, setResults] = useState(saved?.results ?? [])
  const [kanjiResults, setKanjiResults] = useState(saved?.kanjiResults ?? [])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(saved?.hasMore ?? false)
  const [offset, setOffset] = useState(saved?.offset ?? 0)
  const showLoadingMessage = useDelayedLoading(loading)
  const [commonOnly, setCommonOnly] = useState(saved?.commonOnly ?? false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const ticketRef = useRef(0)
  const restoredRef = useRef(saved?.results?.length > 0 ? 2 : 0)
  const scrollRef = useRef(null)
  const scrollSaveRef = useRef(null)
  const romajiHint = useMemo(() => romajiToKana(query.trim()), [query])

  useEffect(() => {
    if (saved?.scrollTop && scrollRef.current) {
      scrollRef.current.scrollTop = saved.scrollTop
    }
  }, [saved?.scrollTop])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        query, results, kanjiResults, hasMore, offset, commonOnly,
        scrollTop: scrollRef.current?.scrollTop ?? 0,
      }))
    } catch (e) { void e }
  }, [query, results, kanjiResults, hasMore, offset, commonOnly])

  const handleScroll = useCallback(() => {
    clearTimeout(scrollSaveRef.current)
    scrollSaveRef.current = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY)
        const state = raw ? JSON.parse(raw) : {}
        state.scrollTop = scrollRef.current?.scrollTop ?? 0
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
      } catch (e) { void e }
    }, 100)
  }, [])

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
    if (restoredRef.current > 0) {
      restoredRef.current -= 1
      return
    }
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
    <ModuleThemeProvider accent={DICTIONARY_ACCENT}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BG }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Dictionary' },
        ]}
        rightSlot={<AuthSlot />}
      >
        <TopProgressBar loading={showLoadingMessage} color={ACCENT} />
      </PageHeader>
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <TextInput
            placeholder="Search Japanese or English..."
            value={query}
            onChange={setQuery}
            size="lg"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{ marginBottom: romajiHint ? 6 : 12 }}
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
            <Checkbox checked={commonOnly} onChange={() => setCommonOnly(v => !v)} label="Common words only" />
            {showResults && (
              <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginLeft: 'auto', opacity: 0.55 }}>
                {results.length}{hasMore ? '+' : ''} results
              </span>
            )}
          </div>

          {loading && showLoadingMessage && (
            <CenteredLoadingMessage text="Searching JMdict" />
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
              {kanjiResults.length > 0 && <SectionHeader title="Words" />}
              <DataList
                columns={ENTRY_ROW_COLUMNS}
                rows={results}
                rowKey={entry => entry.id}
                navigate={{ href: entry => `#/dictionary/entry/${entry.id}` }}
                padding="12px 16px"
                maxWidth={600}
              />

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Button variant="neutral" onClick={() => runSearch(query, offset, true, commonOnly)} disabled={loadingMore}>
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

          <AttributionFooter sources={['dictionary']} />
        </div>
      </div>
    </div>
    </ModuleThemeProvider>
  )
}
