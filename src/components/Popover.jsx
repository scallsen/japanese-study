import { useEffect, useLayoutEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import { FONT, TRACKING, TEXT } from '../data/theme.js'

const SURFACE = '#2A2A2A'
const GAP = 6      // distance from the anchor
const MARGIN = 8   // minimum distance from the viewport edge

/**
 * An anchored floating layer: popover on desktop, bottom sheet on mobile.
 *
 * The positioning here (first-guess below the anchor, then corrected before
 * paint once the real size is known, flipping above and clamping horizontally
 * when there isn't room) was independently hand-written in both
 * `DeckComboBox` and `JapaneseReader`'s `WordPopup` — `DeckComboBox`'s own
 * comment even noted it was "the same technique". This is that logic, once.
 *
 * The mobile branch delegates to `Modal` rather than growing a third
 * bottom-sheet implementation.
 *
 * Anchor by either `anchorRef` (an element — a trigger button) or
 * `anchorRect` (a DOMRect — a clicked word in running text, which has no
 * stable element to hold a ref to).
 */
export default function Popover({
  open,
  onClose,
  anchorRef,
  anchorRect,
  isMobile = false,
  title,
  width = 260,
  zIndex = 200,
  bodyPadding = 0,
  closeOnScroll = true,
  children,
}) {
  const panelRef = useRef(null)

  function currentAnchorRect() {
    return anchorRect ?? anchorRef?.current?.getBoundingClientRect() ?? null
  }

  useEffect(() => {
    if (!open || isMobile) return
    function handleClick(e) {
      const insidePanel = panelRef.current?.contains(e.target)
      const insideAnchor = anchorRef?.current?.contains(e.target)
      if (!insidePanel && !insideAnchor) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, isMobile, onClose, anchorRef])

  // A fixed-position panel doesn't follow its anchor when the page scrolls
  // underneath it, so close rather than show a stale position. Capture phase
  // catches scroll on any ancestor, not just window — this component can't
  // know which container its caller scrolls.
  useEffect(() => {
    if (!open || isMobile || !closeOnScroll) return
    function handleScroll() { onClose() }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open, isMobile, closeOnScroll, onClose])

  useLayoutEffect(() => {
    if (!open || isMobile || !panelRef.current) return
    const rect = currentAnchorRect()
    if (!rect) return

    const el = panelRef.current
    const { width: w, height: h } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + GAP
    let left = rect.left

    if (left + w + MARGIN > vw) left = vw - w - MARGIN
    left = Math.max(MARGIN, left)

    if (top + h + MARGIN > vh) top = rect.top - h - GAP
    top = Math.max(MARGIN, top)

    el.style.top = `${top}px`
    el.style.left = `${left}px`
  })

  if (!open) return null

  if (isMobile) {
    return (
      <Modal open onClose={onClose} title={title} isMobile bodyPadding={bodyPadding}>
        {children}
      </Modal>
    )
  }

  const rect = currentAnchorRect()

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        // First guess; useLayoutEffect corrects it before paint, so there's
        // no visible jump even when the panel has to flip above the anchor.
        top: rect ? rect.bottom + GAP : 0,
        left: rect ? rect.left : 0,
        width,
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
        zIndex,
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        padding: bodyPadding,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        color: TEXT,
        animation: 'modal-fade-scale-in-top 120ms ease-out',
      }}
    >
      {children}
    </div>
  )
}
