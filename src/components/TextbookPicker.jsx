import Modal from './Modal.jsx'
import OptionPicker from './OptionPicker.jsx'
import { TEXTBOOKS } from '../data/textbooks.js'
import { useIsMobile } from '../hooks/useIsMobile.js'

// The "Change textbook" surface. Picking a book replaces the current one —
// the app is built around studying one textbook at a time, so this is a
// deliberate swap action, not a multi-select. Composes Modal + OptionPicker
// per settled decision #6 rather than growing its own list.
export default function TextbookPicker({ open, onClose, currentId, onSelect, wordCountFor }) {
  const isMobile = useIsMobile()
  const items = TEXTBOOKS.map(book => {
    const hasWords = book.chapters.some(ch => wordCountFor(ch.id) > 0)
    const parts = [`${book.chapters.length} chapters`]
    if (!hasWords) parts.push('no words yet')
    if (book.id === currentId) parts.unshift('Current')
    return { id: book.id, label: book.title, meta: parts.join(' · ') }
  })

  return (
    <Modal open={open} onClose={onClose} title="Change textbook" isMobile={isMobile} bodyPadding={0}>
      <OptionPicker
        items={items}
        placeholder="Search textbooks…"
        onSelect={id => { onSelect(id); onClose() }}
        maxHeight={360}
      />
    </Modal>
  )
}
