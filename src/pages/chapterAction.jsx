// Kept out of homeCards.jsx (a component file) to satisfy react-refresh
// lint — same reasoning as attributionSegments.jsx: a non-component export
// mixed into a file of components breaks fast refresh for that file.

// Shared between the home card and the vocab training page's own header —
// both show the same primary action for the chapter under the tracker.
// Advancing (moving off a drilled current chapter onto the next one) always
// goes through `onAdvance`, which is where the SRS gate hangs; redoing the
// current chapter never touches the tracker, so it's a plain `onStart`.
export function chapterPrimaryAction(state, { onStart, onAdvance, onChangeTextbook }) {
  const { chapters, current, next, doneCount } = state
  if (doneCount === chapters.length) {
    return { label: 'Pick new word list', onClick: onChangeTextbook, menuItems: [] }
  }
  if (current.drilled && next) {
    return {
      label: `Redo ${current.label}`,
      onClick: () => onStart(current),
      menuItems: [{ id: 'next', label: 'Next chapter', onClick: onAdvance }],
    }
  }
  return {
    label: `${current.drilled ? 'Redo' : 'Start'} ${current.label}`,
    onClick: () => onStart(current),
    menuItems: [],
  }
}
