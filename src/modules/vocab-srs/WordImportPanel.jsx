import { useState, useEffect, useMemo } from 'react'
import { createCard } from './srs.js'
import { extractWordsFromText, extractWordsFromImage, readImageAsBase64 } from './wordImportApi.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_HEADING } from '../../data/theme.js'

const ACCENT = '#3ABDA4'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function TabButton({ active, onClick, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px',
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        background: active ? 'rgba(58,189,164,0.15)' : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? ACCENT : TEXT_MUTED,
        border: `1px solid ${active ? 'rgba(58,189,164,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 130ms',
      }}
    >
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, disabled, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 20px',
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        background: disabled ? 'rgba(255,255,255,0.04)' : hovered ? 'rgba(58,189,164,0.28)' : 'rgba(58,189,164,0.18)',
        color: disabled ? TEXT_MUTED : ACCENT,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.1)' : 'rgba(58,189,164,0.45)'}`,
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 130ms',
      }}
    >
      {children}
    </button>
  )
}

// capture="environment" opens the rear camera directly on mobile (iOS/Android);
// desktop browsers ignore it and just show the normal file picker, so this needs
// no feature-detection branch — it degrades to "Choose image" behavior on its own.
function FileTrigger({ label, capture, onChange }) {
  return (
    <label style={{ cursor: 'pointer' }}>
      <div style={{
        display: 'inline-block', padding: '8px 16px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6, fontSize: FS_BASE, color: 'rgba(255,255,255,0.7)',
        fontFamily: FONT, letterSpacing: TRACKING,
      }}>
        {label}
      </div>
      <input type="file" accept="image/*" capture={capture} style={{ display: 'none' }} onChange={onChange} />
    </label>
  )
}

function rowInputStyle(width) {
  return {
    width,
    padding: '5px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    color: TEXT,
    fontFamily: FONT,
    fontSize: FS_CAPTION,
    letterSpacing: TRACKING,
  }
}

function WordRow({ word, onToggle, onEdit }) {
  const missing = !word.jmdictId
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      opacity: word.selected ? 1 : 0.4,
    }}>
      <input type="checkbox" checked={word.selected} onChange={onToggle} style={{ flexShrink: 0, cursor: 'pointer' }} />
      <input
        value={word.surface}
        onChange={e => onEdit('surface', e.target.value)}
        style={{ ...rowInputStyle(90), fontFamily: "'DotGothic16', system-ui, sans-serif" }}
      />
      <input
        value={word.reading}
        onChange={e => onEdit('reading', e.target.value)}
        placeholder="reading"
        style={{ ...rowInputStyle(90), fontFamily: "'DotGothic16', system-ui, sans-serif" }}
      />
      <input
        value={word.meaning}
        onChange={e => onEdit('meaning', e.target.value)}
        placeholder={missing ? 'no dictionary match — enter meaning' : 'meaning'}
        style={{ ...rowInputStyle(0), flex: 1 }}
      />
    </div>
  )
}

export default function WordImportPanel({ open, onClose, onConfirm }) {
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [stage, setStage] = useState('input') // 'input' | 'loading' | 'review' | 'done'
  const [error, setError] = useState(null)
  const [words, setWords] = useState([])
  const [truncated, setTruncated] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  const imagePreviewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl) }, [imagePreviewUrl])

  if (!open) return null

  function reset() {
    setTab('text')
    setText('')
    setImageFile(null)
    setStage('input')
    setError(null)
    setWords([])
    setTruncated(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleExtract() {
    setError(null)
    if (tab === 'text') {
      if (!text.trim()) { setError('Paste some Japanese text first'); return }
    } else if (!imageFile) {
      setError('Choose an image first'); return
    }

    setStage('loading')
    try {
      let result
      if (tab === 'text') {
        result = await extractWordsFromText(text.trim())
      } else {
        const { image, mediaType } = await readImageAsBase64(imageFile)
        result = await extractWordsFromImage(image, mediaType)
      }

      if (!result?.words?.length) {
        setError('No Japanese words found')
        setStage('input')
        return
      }

      setWords(result.words.map(w => ({ ...w, selected: true })))
      setTruncated(!!result.truncated)
      setStage('review')
    } catch (err) {
      setError(err.message || 'Extraction failed')
      setStage('input')
    }
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image too large (max 8MB)')
      e.target.value = ''
      return
    }
    setError(null)
    setImageFile(file)
  }

  function toggleWord(id) {
    setWords(ws => ws.map(w => (w.id === id ? { ...w, selected: !w.selected } : w)))
  }

  function editWord(id, field, value) {
    setWords(ws => ws.map(w => (w.id === id ? { ...w, [field]: value } : w)))
  }

  function selectAll(selected) {
    setWords(ws => ws.map(w => ({ ...w, selected })))
  }

  async function handleConfirm() {
    const selected = words.filter(w => w.selected && w.surface.trim() && w.meaning.trim())
    if (!selected.length) {
      setError('Select at least one word with a meaning filled in')
      return
    }

    const ts = Date.now()
    const cards = selected.map((w, i) => {
      const extras = {}
      if (w.reading.trim()) extras.kana = w.reading.trim()
      if (w.jmdictId) extras.jmdictId = w.jmdictId
      return createCard(w.surface.trim(), w.meaning.trim(), `word-import-${ts}-${i}`, 'word-import', extras)
    })

    await onConfirm(cards)
    setDoneCount(cards.length)
    setStage('done')
  }

  const selectedCount = words.filter(w => w.selected).length

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(640px, 92vw)',
        maxHeight: '86vh',
        background: '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        zIndex: 41,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        color: TEXT,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        }}>
          <div style={{ fontSize: FS_HEADING, color: TEXT }}>Import words</div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: FS_BASE, fontFamily: FONT, cursor: 'pointer', padding: 4 }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto' }}>
          {stage === 'done' ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: FS_HEADING, color: TEXT, marginBottom: 8 }}>
                {doneCount} word{doneCount === 1 ? '' : 's'} added
              </div>
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 20 }}>
                Added to the &ldquo;Imported Words&rdquo; deck
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <PrimaryButton onClick={reset}>Import more</PrimaryButton>
                <TabButton active={false} onClick={handleClose}>Done</TabButton>
              </div>
            </div>
          ) : stage === 'review' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED }}>
                  {words.length} word{words.length === 1 ? '' : 's'} found · {selectedCount} selected
                  {truncated && ` (showing first ${words.length})`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => selectAll(true)} style={{ background: 'none', border: 'none', color: ACCENT, fontFamily: FONT, fontSize: FS_CAPTION, cursor: 'pointer' }}>Select all</button>
                  <button onClick={() => selectAll(false)} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_CAPTION, cursor: 'pointer' }}>Select none</button>
                </div>
              </div>

              <div>
                {words.map(w => (
                  <WordRow
                    key={w.id}
                    word={w}
                    onToggle={() => toggleWord(w.id)}
                    onEdit={(field, value) => editWord(w.id, field, value)}
                  />
                ))}
              </div>

              {error && <div style={{ color: '#f87171', fontSize: FS_CAPTION, marginTop: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <PrimaryButton onClick={handleConfirm} disabled={selectedCount === 0}>
                  Add {selectedCount} word{selectedCount === 1 ? '' : 's'} to SRS
                </PrimaryButton>
                <TabButton active={false} onClick={() => setStage('input')}>Back</TabButton>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <TabButton active={tab === 'text'} onClick={() => setTab('text')}>Paste text</TabButton>
                <TabButton active={tab === 'image'} onClick={() => setTab('image')}>Image (OCR)</TabButton>
              </div>

              {tab === 'text' ? (
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste Japanese text here..."
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    color: TEXT,
                    fontFamily: FONT,
                    fontSize: FS_BASE,
                    letterSpacing: TRACKING,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <FileTrigger label="Take photo" capture="environment" onChange={handleImageChange} />
                    <FileTrigger label="Choose image" onChange={handleImageChange} />
                  </div>
                  {imagePreviewUrl && (
                    <img
                      src={imagePreviewUrl}
                      alt="Selected"
                      style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  )}
                </div>
              )}

              {error && <div style={{ color: '#f87171', fontSize: FS_CAPTION, marginTop: 12 }}>{error}</div>}

              <div style={{ marginTop: 18 }}>
                <PrimaryButton onClick={handleExtract} disabled={stage === 'loading'}>
                  {stage === 'loading' ? 'Extracting...' : 'Extract words'}
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
