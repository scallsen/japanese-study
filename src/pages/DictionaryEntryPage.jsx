import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import { supabase } from '../lib/supabase.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../data/theme.js'

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'

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
    .select('literal, on_readings, kun_readings, meanings, jlpt, grade, stroke_count')
    .in('literal', chars)
  if (error) throw error
  return chars.map(ch => (data ?? []).find(r => r.literal === ch)).filter(Boolean)
}

function PosTag({ label }) {
  return (
    <span style={{
      fontSize: 10,
      color: TEXT_MUTED,
      background: 'rgba(255,255,255,0.07)',
      borderRadius: 3,
      padding: '2px 7px',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      flexShrink: 0,
    }}>{label}</span>
  )
}

function MetaTag({ label, color }) {
  return (
    <span style={{
      fontSize: 10,
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
              {group.pos.map((p, i) => <PosTag key={i} label={p} />)}
            </div>
          )}
          <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.senses.map((sense, si) => (
              <li key={si} style={{ color: TEXT, fontFamily: FONT, fontSize: 14, letterSpacing: TRACKING, lineHeight: 1.55 }}>
                {sense.gloss.join('; ')}
                {(sense.field?.length > 0 || sense.misc?.length > 0 || sense.info?.length > 0) && (
                  <span style={{ display: 'inline-flex', gap: 6, marginLeft: 8, verticalAlign: 'middle', flexWrap: 'wrap' }}>
                    {sense.field?.map((f, i) => <MetaTag key={i} label={f} color="#7EB8D4" />)}
                    {sense.misc?.map((m, i) => <MetaTag key={i} label={m} />)}
                    {sense.info?.map((n, i) => <MetaTag key={i} label={n} />)}
                  </span>
                )}
                {(sense.related?.length > 0 || sense.antonym?.length > 0) && (
                  <div style={{ marginTop: 2, fontSize: 11, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7 }}>
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
  const jlptLabel = entry.jlpt ? `N${entry.jlpt}` : null
  const gradeLabel = entry.grade && entry.grade <= 6 ? `G${entry.grade}` : null

  return (
    <div style={{
      background: SURFACE,
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 38, color: TEXT, fontFamily: FONT, lineHeight: 1, letterSpacing: 0, flexShrink: 0, minWidth: 44, textAlign: 'center' }}>
        {entry.literal}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
          {entry.on_readings?.length > 0 && (
            <span style={{ fontSize: 13, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
              {entry.on_readings.join('、')}
            </span>
          )}
          {entry.kun_readings?.length > 0 && (
            <span style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {entry.kun_readings.join('、')}
            </span>
          )}
          {jlptLabel && (
            <span style={{ fontSize: 10, color: '#3ABDA4', fontFamily: FONT, letterSpacing: TRACKING }}>{jlptLabel}</span>
          )}
          {gradeLabel && !jlptLabel && (
            <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>{gradeLabel}</span>
          )}
          {entry.stroke_count && (
            <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.6 }}>
              {entry.stroke_count} strokes
            </span>
          )}
        </div>
        {entry.meanings && (
          <span style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {entry.meanings}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 28 }}>
      <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.1em', opacity: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

export default function DictionaryEntryPage({ entryId }) {
  const [entry, setEntry] = useState(null)
  const [kanjiDetails, setKanjiDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEntry(entryId)
      .then(async data => {
        if (cancelled) return
        setEntry(data)
        const chars = extractKanjiChars(data.primary_form)
        const kd = await fetchKanjiDetails(chars)
        if (!cancelled) setKanjiDetails(kd)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entryId])

  const allForms = entry
    ? [...new Set([
        ...(entry.kanji_forms ?? []),
        ...(entry.kana_forms ?? []),
      ])]
    : []

  const altForms = allForms.filter(f => f !== entry?.primary_form)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BG }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Dictionary', href: '#/dictionary' },
          { label: entry?.primary_form ?? '…' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 16px 64px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '64px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: 13, letterSpacing: TRACKING }}>
              Loading...
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '64px 0', color: '#E05A4E', fontFamily: FONT, fontSize: 13, letterSpacing: TRACKING }}>
              {error}
            </div>
          )}

          {!loading && entry && (
            <>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 52, color: TEXT, fontFamily: FONT, letterSpacing: 0, lineHeight: 1.1 }}>
                    {entry.primary_form}
                  </span>
                  {entry.common && (
                    <span style={{ fontSize: 11, color: '#3ABDA4', fontFamily: FONT, letterSpacing: TRACKING }}>common</span>
                  )}
                </div>

                {altForms.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {altForms.map((f, i) => (
                      <span key={i} style={{ fontSize: 18, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Definitions */}
              <div style={{ background: SURFACE, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '18px 20px' }}>
                {entry.senses ? (
                  <SensesSection senses={entry.senses} />
                ) : (
                  /* fallback for rows imported before senses column */
                  <div style={{ color: TEXT, fontFamily: FONT, fontSize: 14, letterSpacing: TRACKING, lineHeight: 1.65 }}>
                    {entry.gloss_en}
                  </div>
                )}
              </div>

              {/* Kanji breakdown */}
              {kanjiDetails.length > 0 && (
                <>
                  <SectionLabel label="Kanji" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {kanjiDetails.map(k => <KanjiCard key={k.literal} entry={k} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
