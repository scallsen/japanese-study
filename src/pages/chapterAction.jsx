import { FS_BASE, TEXT_MUTED } from '../data/theme.js'

// Kept out of homeCards.jsx (a component file) to satisfy react-refresh
// lint — same reasoning as attributionSegments.jsx: a non-component export
// mixed into a file of components breaks fast refresh for that file. No
// local component helper here either, for the same reason — inline the JSX.

// Shared between the home card and the vocab training page's own header —
// both show the same primary action for the chapter under the tracker.
// Advancing (moving off a drilled current chapter onto the next one) always
// goes through `onAdvance`, which is where the SRS gate hangs; redoing the
// current chapter never touches the tracker, so it's a plain `onStart`.
export function chapterPrimaryAction(state, { onStart, onAdvance, onChangeTextbook }) {
  const { chapters, current, next, doneCount } = state
  if (doneCount === chapters.length) {
    return { label: 'Pick new textbook', onClick: onChangeTextbook, menuItems: [], body: null }
  }
  if (current.drilled && next) {
    return {
      label: `Start ${next.label}`,
      onClick: onAdvance,
      menuItems: [{ id: 'redo', label: `Redo ${current.label}`, onClick: () => onStart(current) }],
      body: <div style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>{current.label} drilled ✓</div>,
    }
  }
  return {
    label: `${current.drilled ? 'Redo' : 'Start'} ${current.label}`,
    onClick: () => onStart(current),
    menuItems: [],
    body: null,
  }
}
