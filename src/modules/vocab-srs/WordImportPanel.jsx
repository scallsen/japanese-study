import { useState, useEffect, useMemo } from 'react'
import { extractWordsFromText, extractWordsFromImage, readImageAsBase64 } from './wordImportApi.js'
import DeckComboBox from '../../components/DeckComboBox.jsx'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import FileButton from '../../components/FileButton.jsx'
import DataList from '../../components/DataList.jsx'
import ChipSelector from '../../components/Chip.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_HEADING, DANGER } from '../../data/theme.js'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const TAB_OPTIONS = [
  { value: 'text', label: 'Paste text' },
  { value: 'image', label: 'Image (OCR)' },
]

// Editable review table: surface / reading / meaning are inline inputs.
const REVIEW_COLUMNS = [
  { key: 'surface', width: 90 },
  { key: 'reading', width: 90, placeholder: 'reading' },
  { key: 'meaning', placeholder: row => (row.jmdictId ? 'meaning' : 'no dictionary match — enter meaning') },
]
const EDITABLE_FIELDS = ['surface', 'reading', 'meaning']

export default function WordImportPanel({ open, onClose, decks, isMobile, onAdd, onCreateAndAdd }) {
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

  const selectedIds = useMemo(() => new Set(words.filter(w => w.selected).map(w => w.id)), [words])

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

  function handleImageFile(file) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image too large (max 8MB)')
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

  function selectedPayload() {
    return words
      .filter(w => w.selected && w.surface.trim() && w.meaning.trim())
      .map(w => ({ surface: w.surface.trim(), reading: w.reading.trim(), meaning: w.meaning.trim(), jmdictId: w.jmdictId }))
  }

  async function handleAdd(deckId) {
    const payload = selectedPayload()
    if (!payload.length) {
      setError('Select at least one word with a meaning filled in')
      return
    }
    await onAdd(payload, deckId)
    setDoneCount(payload.length)
    setStage('done')
  }

  async function handleCreateAndAdd(name) {
    const payload = selectedPayload()
    if (!payload.length) {
      setError('Select at least one word with a meaning filled in')
      return
    }
    await onCreateAndAdd(payload, name)
    setDoneCount(payload.length)
    setStage('done')
  }

  const selectedCount = words.filter(w => w.selected).length

  return (
    <Modal open={open} onClose={handleClose} title="Import words" size="xl" isMobile={isMobile}>
      <div style={{ fontFamily: FONT, letterSpacing: TRACKING, color: TEXT }}>
        {stage === 'done' ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: FS_HEADING, color: TEXT, marginBottom: 20 }}>
              {doneCount} word{doneCount === 1 ? '' : 's'} added
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="accent-outline" onClick={reset}>Import more</Button>
              <Button variant="neutral" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : stage === 'review' ? (
          <>
            <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: 10 }}>
              {words.length} word{words.length === 1 ? '' : 's'} found
              {truncated && ` (showing first ${words.length})`}
            </div>

            <DataList
              columns={REVIEW_COLUMNS}
              rows={words}
              editableFields={EDITABLE_FIELDS}
              onFieldChange={(row, key, value) => editWord(row.id, key, value)}
              selection={{ selected: selectedIds, onToggle: toggleWord, bulkHeader: true }}
              gap={8}
              padding="8px 12px"
              maxWidth="100%"
            />

            {error && <div style={{ color: DANGER, fontSize: FS_CAPTION, marginTop: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <DeckComboBox
                decks={decks}
                isMobile={isMobile}
                disabled={selectedCount === 0}
                buttonLabel={`Add ${selectedCount} word${selectedCount === 1 ? '' : 's'} to SRS`}
                onAdd={handleAdd}
                onCreateAndAdd={handleCreateAndAdd}
              />
              <Button variant="neutral" onClick={() => setStage('input')}>Back</Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <ChipSelector mode="single" size="md" options={TAB_OPTIONS} value={tab} onChange={setTab} />
            </div>

            {tab === 'text' ? (
              // No multiline TextInput in the library yet — see the review log.
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
                  {/* capture="environment" opens the rear camera directly on mobile;
                      desktop browsers ignore it and show the normal picker. */}
                  <FileButton accept="image/*" capture="environment" onFile={handleImageFile}>Take photo</FileButton>
                  <FileButton accept="image/*" onFile={handleImageFile}>Choose image</FileButton>
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

            {error && <div style={{ color: DANGER, fontSize: FS_CAPTION, marginTop: 12 }}>{error}</div>}

            <div style={{ marginTop: 18 }}>
              <Button variant="accent-outline" onClick={handleExtract} disabled={stage === 'loading'}>
                {stage === 'loading' ? 'Extracting...' : 'Extract words'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
