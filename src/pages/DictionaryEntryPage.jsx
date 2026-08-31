import { useState, useEffect, useMemo } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import { supabase } from '../lib/supabase.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_CAPTION, FS_ENTRY_HEADING, FS_ENTRY_ALT } from '../data/theme.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { migrateProgress } from '../modules/vocab-srs/migrate.js'
import { resolveCard, cardStateLabel } from '../modules/vocab-srs/srs.js'
import { WORD_DATA } from '../data/wordData.js'
import { WORD_SOURCES } from '../data/wordLists.js'
import AttributionFooter from '../components/AttributionFooter.jsx'
import Badge from '../components/Badge.jsx'
import Card from '../components/Card.jsx'
import CenteredLoadingMessage from '../components/CenteredLoadingMessage.jsx'
import DataList from '../components/DataList.jsx'
import { MODULES } from '../data/modules.js'
import { ModuleThemeProvider } from '../context/ModuleThemeContext.jsx'
import { SectionLabel, KanjiBreakdownEntry, KANJI_FONT } from './dictionaryShared.jsx'

const BG = '#1E1E1E'
const DICTIONARY_ACCENT = MODULES.find(m => m.id === 'dictionary').accent

function isSingleKanji(ch) {
  return /^[一-鿿]$/.test(ch)
}

function extractKanjiChars(word) {
  return [...word].filter(ch => isSingleKanji(ch))
}

async function fetchEntry(id) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('dictionary')
    .select('id, primary_form, kanji_forms, kana_forms, gloss_en, pos, common, senses')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

async function fetchKanjiDetails(chars) {
  if (!supabase || !chars.length) return []
  const { data, error } = await supabase
    .from('kanji')
    .select('literal, on_readings, kun_readings, meanings, jlpt, grade, stroke_count, frequency')
    .in('literal', chars)
  if (error) throw error
  return chars.map(ch => (data ?? []).find(r => r.literal === ch)).filter(Boolean)
}

const MAX_SENTENCES = 5

async function fetchSentences(id) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('sentences')
    .select('id, japanese, english, quality')
    .overlaps('dictionary_ids', [id])
    .order('quality', { ascending: false })
    .limit(MAX_SENTENCES)
  if (error) throw error
  return data ?? []
}

// Resolves a Vocab Drill word's listKey to a human label: "Source — Sublist"
// for hierarchical sources, or just the source label for flat ones.
function labelForListKey(listKey) {
  for (const source of WORD_SOURCES) {
    if (!source.lists) {
      if (source.id === listKey) return source.label
      continue
    }
    const sublist = source.lists.find(l => l.id === listKey)
    if (sublist) return `${source.label} — ${sublist.label}`
  }
  return listKey
}

const LANG_NAMES = { eng: 'English', fre: 'French', ger: 'German', deu: 'German', por: 'Portuguese', ita: 'Italian', spa: 'Spanish', chi: 'Chinese', zho: 'Chinese', kor: 'Korean', nld: 'Dutch', rus: 'Russian', ara: 'Arabic', per: 'Persian', hin: 'Hindi' }
function langName(code) { return LANG_NAMES[code] ?? code }

function MetaTag({ label, color }) {
  return (
    <span style={{
      fontSize: FS_BADGE,
      color: color ?? TEXT_MUTED,
      fontFamily: FONT,
      letterSpacing: TRACKING,
      opacity: 0.7,
    }}>{label}</span>
  )
}

function SensesSection({ senses }) {
  if (!senses?.length) return null

  // Group consecutive senses that share the same pos signature
  const groups = []
  for (const sense of senses) {
    const posKey = (sense.pos ?? []).join('|')
    const last = groups[groups.length - 1]
    if (last && last.posKey === posKey) {
      last.senses.push(sense)
    } else {
      groups.push({ posKey, pos: sense.pos ?? [], senses: [sense] })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.pos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {group.pos.map((p, i) => <Badge key={i} variant="fill" tone="neutral">{p}</Badge>)}
            </div>
          )}
          <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.senses.map((sense, si) => (
              <li key={si} style={{ color: TEXT, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING, lineHeight: 1.55 }}>
                {sense.gloss.join('; ')}
                {(sense.field?.length > 0 || sense.misc?.length > 0 || sense.info?.length > 0 || sense.dialect?.length > 0) && (
                  <span style={{ display: 'inline-flex', gap: 6, marginLeft: 8, verticalAlign: 'middle', flexWrap: 'wrap' }}>
                    {sense.field?.map((f, i) => <MetaTag key={i} label={f} color="#7EB8D4" />)}
                    {sense.dialect?.map((d, i) => <MetaTag key={i} label={d} color="#B39DDB" />)}
                    {sense.misc?.map((m, i) => <MetaTag key={i} label={m} />)}
                    {sense.info?.map((n, i) => <MetaTag key={i} label={n} />)}
                  </span>
                )}
                {sense.languageSource?.length > 0 && (
                  <div style={{ marginTop: 3, fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7 }}>
                    {sense.languageSource.map((ls, i) => (
                      <span key={i}>
                        {ls.wasei ? 'Wasei' : `From ${langName(ls.lang)}`}{ls.text ? `: ${ls.text}` : ''}
                        {i < sense.languageSource.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {(sense.related?.length > 0 || sense.antonym?.length > 0) && (
                  <div style={{ marginTop: 2, fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7 }}>
                    {sense.related?.length > 0 && <span>See also: {sense.related.join(', ')} </span>}
                    {sense.antonym?.length > 0 && <span>Antonym: {sense.antonym.join(', ')}</span>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function KanjiCard({ entry }) {
  return (
    <Card style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <KanjiBreakdownEntry entry={entry} />
    </Card>
  )
}

const SRS_STATE_LABELS = { new: 'New', learning: 'Learning', young: 'Young', mature: 'Mature', relearning: 'Relearning' }

// Content-only — DataList's Cell wraps this; the row's own <a>, background,
// border and hover treatment come from DataList itself (navigate.href
// below), converging onto the same list surface EntryRow uses rather than
// each deck staying its own floating card.
function deckRowContent({ label, meta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
      <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>{label}</span>
      {meta && (
        <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>{meta}</span>
      )}
    </div>
  )
}

const DECK_ROW_COLUMNS = [{ key: 'content', render: deckRowContent }]

function SentenceCard({ sentence }) {
  return (
    <Card padding="12px 16px">
      <div style={{ fontSize: FS_BASE, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.6 }}>
        {sentence.japanese}
      </div>
      <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginTop: 4 }}>
        {sentence.english}
      </div>
    </Card>
  )
}

export default function DictionaryEntryPage({ entryId }) {
  const [entry, setEntry] = useState(null)
  const [kanjiDetails, setKanjiDetails] = useState([])
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { user } = useAuth()
  const { data: rawSrsProgress } = useProgress('vocab-srs')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSentences([])
    fetchEntry(entryId)
      .then(async data => {
        if (cancelled) return
        setEntry(data)
        const [kd, sentenceRows] = await Promise.all([
          fetchKanjiDetails(extractKanjiChars(data.primary_form)),
          fetchSentences(data.id),
        ])
        if (!cancelled) {
          setKanjiDetails(kd)
          setSentences(sentenceRows)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entryId])

  const vocabDrillMatches = useMemo(() => {
    if (!entry) return []
    const labels = new Set(WORD_DATA.filter(w => w.jmdictId === entry.id).map(w => labelForListKey(w.listKey)))
    return [...labels]
  }, [entry])

  const srsMatches = useMemo(() => {
    if (!entry || !user) return []
    const progress = migrateProgress(rawSrsProgress)
    const matches = []
    for (const card of Object.values(progress.cards)) {
      const resolved = resolveCard(card)
      if (resolved.jmdictId !== entry.id) continue
      matches.push({
        cardId: card.id,
        deckName: progress.decks[card.deckId]?.name ?? card.deckId,
        state: cardStateLabel(card),
        due: card.due ? new Date(card.due) : null,
      })
    }
    return matches
  }, [entry, user, rawSrsProgress])

  const showDecksSection = vocabDrillMatches.length > 0 || !!user

  const deckRows = useMemo(() => {
    const rows = vocabDrillMatches.map(label => ({ id: `vocab-${label}`, label, href: '#/vocab', meta: 'Vocab Drill' }))
    if (user) {
      for (const m of srsMatches) {
        rows.push({ id: m.cardId, label: m.deckName, href: '#/vocab-srs', meta: SRS_STATE_LABELS[m.state] ?? m.state })
      }
    }
    return rows
  }, [vocabDrillMatches, user, srsMatches])

  const allForms = entry
    ? [...new Set([
        ...(entry.kanji_forms ?? []),
        ...(entry.kana_forms ?? []),
      ])]
    : []

  const altForms = allForms.filter(f => f !== entry?.primary_form)

  return (
    <ModuleThemeProvider accent={DICTIONARY_ACCENT}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BG }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Dictionary', href: '#/dictionary' },
          { label: entry?.primary_form ?? '…' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 16px 64px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {loading && <CenteredLoadingMessage text="Loading..." />}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '64px 0', color: '#E05A4E', fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
              {error}
            </div>
          )}

          {!loading && entry && (
            <>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: FS_ENTRY_HEADING, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0, lineHeight: 1.1 }}>
                    {entry.primary_form}
                  </span>
                  {entry.common && <Badge variant="text" tone="accent">common</Badge>}
                </div>

                {altForms.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {altForms.map((f, i) => (
                      <span key={i} style={{ fontSize: FS_ENTRY_ALT, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Definitions */}
              <Card padding="18px 20px">
                {entry.senses ? (
                  <SensesSection senses={entry.senses} />
                ) : (
                  /* fallback for rows imported before senses column */
                  <div style={{ color: TEXT, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING, lineHeight: 1.65 }}>
                    {entry.gloss_en}
                  </div>
                )}
              </Card>

              {/* Your decks */}
              {showDecksSection && (
                <>
                  <SectionLabel label="Your Decks" marginTop={28} />
                  {deckRows.length > 0 && (
                    <DataList
                      columns={DECK_ROW_COLUMNS}
                      rows={deckRows}
                      rowKey={row => row.id}
                      navigate={{ href: row => row.href }}
                      padding="10px 14px"
                      maxWidth={600}
                    />
                  )}
                  {user && srsMatches.length === 0 && (
                    <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.6, padding: '2px 2px', marginTop: deckRows.length > 0 ? 8 : 0 }}>
                      Not in any of your SRS decks yet.
                    </div>
                  )}
                </>
              )}

              {/* Kanji breakdown */}
              {kanjiDetails.length > 0 && (
                <>
                  <SectionLabel label="Kanji" marginTop={28} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {kanjiDetails.map(k => <KanjiCard key={k.literal} entry={k} />)}
                  </div>
                </>
              )}

              {/* Example sentences */}
              {sentences.length > 0 && (
                <>
                  <SectionLabel label="Example Sentences" marginTop={28} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sentences.map(s => <SentenceCard key={s.id} sentence={s} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>

          {!loading && entry && (
            <AttributionFooter sources={sentences.length > 0 ? ['dictionary', 'tanaka-corpus'] : ['dictionary']} />
          )}
        </div>
      </div>
    </div>
    </ModuleThemeProvider>
  )
}
