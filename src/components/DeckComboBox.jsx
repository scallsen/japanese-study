import { useState, useRef } from 'react'
import { isBundledDeck } from '../modules/vocab-srs/deckUtils.js'
import Button from './Button.jsx'
import Popover from './Popover.jsx'
import OptionPicker from './OptionPicker.jsx'
import { deckPickerItems } from './deckPickerItems.js'

/**
 * THE deck picker for the app: pick an existing deck or create one and pick
 * it, in a single control. Popover on desktop, bottom sheet on mobile, with a
 * "+ Create «typed»" row appearing as soon as the query doesn't match.
 *
 * Now a thin domain wrapper — `Popover` owns the floating surface and
 * `OptionPicker` owns the search/list/create behaviour, so all this holds is
 * the deck-specific part: hiding bundled decks and mapping them to options.
 *
 * `DeckPickerSheet` and `SegmentedDeckAdd` solve the same job two other ways
 * and are retired; port their call sites here rather than extending them.
 */
export default function DeckComboBox({
  decks,
  onAdd,
  onCreateAndAdd,
  isMobile,
  disabled = false,
  fullWidth = false,
  buttonLabel = 'Add to SRS',
  title = 'Add to which deck?',
  lastUsedDeckId,
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)

  function handleSelect(deckId) {
    onAdd(deckId)
    setOpen(false)
  }

  function handleCreate(name) {
    onCreateAndAdd(name)
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant="accent-outline"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        fullWidth={fullWidth}
      >
        {buttonLabel}
      </Button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        isMobile={isMobile}
        title={title}
      >
        <OptionPicker
          items={deckPickerItems(decks, { lastUsedDeckId, exclude: isBundledDeck })}
          onSelect={handleSelect}
          onCreate={handleCreate}
          placeholder="Search or create a deck"
          emptyMessage="No decks yet"
        />
      </Popover>
    </>
  )
}
