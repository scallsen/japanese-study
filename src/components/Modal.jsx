import { useState, useEffect, useRef } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_HEADING, SPACE_8, SPACE_16 } from '../data/theme.js'

const SURFACE = '#2A2A2A'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const EXIT_MS = 160

// Real widths already in use: ConfirmDialog 380, DeckPickerSheet 420,
// WordImportPanel's review table 640 (three editable columns need the room).
const WIDTHS = { sm: 380, md: 420, lg: 560, xl: 640 }

/**
 * The scrim + panel shell every overlay in the app should mount into.
 * Five separate call sites (ConfirmDialog, WordImportPanel, DeckComboBox's
 * mobile branch, DeckPickerSheet, SegmentedDeckAdd's CreateDeckModal) each
 * hand-rolled this: fixed-inset scrim, z-index, the desktop-dialog vs
 * mobile-bottom-sheet switch, and a close affordance.
 *
 * The desktop/mobile split is a real responsive behavior change, not a
 * style tweak — a centered dialog is wrong on a phone and a bottom sheet is
 * wrong on a desktop — so it lives here once rather than in every consumer.
 *
 * header/footer are optional slots; `children` is the scrollable body.
 */
export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  isMobile = false,
  footer,
  closeLabel = 'Close',
  // A modal whose footer already offers an explicit way out (a Cancel
  // button) shouldn't also carry a header Close — two dismiss affordances
  // for one action reads as a mistake. Confirm-style dialogs pass false.
  showClose = true,
  // Full-bleed content (a list whose rows should touch the panel edges)
  // passes 0; prose content keeps the default inset.
  bodyPadding = SPACE_16,
  children,
}) {
  // Closing has to be a rendered state, not just an unmount: React removes
  // the node immediately, so without holding it on screen for the exit
  // animation's duration the panel simply vanishes. Same pattern Toast uses.
  const [closing, setClosing] = useState(false)
  const exitTimer = useRef(null)

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  // A modal reopened before its exit finished would otherwise stay stuck in
  // the closing state and immediately animate itself back out.
  useEffect(() => {
    if (open) setClosing(false)
  }, [open])

  function handleClose() {
    setClosing(true)
    exitTimer.current = setTimeout(() => {
      setClosing(false)
      onClose()
    }, EXIT_MS)
  }

  if (!open) return null

  const panelStyle = isMobile
    ? {
        position: 'fixed', left: 0, right: 0, bottom: 0,
        maxHeight: '80vh',
        borderTopLeftRadius: 14, borderTopRightRadius: 14,
        borderBottom: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
        animation: closing
          ? `modal-slide-down ${EXIT_MS}ms ease-in forwards`
          : 'modal-slide-up 220ms ease-out',
      }
    : {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(${WIDTHS[size] ?? WIDTHS.md}px, 92vw)`,
        maxHeight: '80vh',
        borderRadius: 10,
        animation: closing
          ? `modal-fade-scale-out ${EXIT_MS}ms ease-in forwards`
          : 'modal-fade-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
          animation: closing
            ? `modal-backdrop-fade-out ${EXIT_MS}ms ease-in forwards`
            : 'modal-backdrop-fade-in 160ms ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          ...panelStyle,
          background: SURFACE,
          border: '1px solid rgba(255,255,255,0.12)',
          zIndex: 41,
          display: 'flex', flexDirection: 'column',
          fontFamily: FONT, letterSpacing: TRACKING, color: TEXT,
        }}
      >
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `14px ${SPACE_16}px`, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0,
          }}>
            <div style={{ fontSize: FS_HEADING, color: TEXT }}>{title}</div>
            {showClose && (
              <button
                onClick={handleClose}
                aria-label={closeLabel}
                title={closeLabel}
                className="modal-close-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, flexShrink: 0,
                  background: 'none', border: 'none', borderRadius: 6, color: TEXT_MUTED,
                  fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: bodyPadding }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: 'flex', gap: SPACE_8, justifyContent: 'flex-end',
            padding: `14px ${SPACE_16}px`, borderTop: `1px solid ${HAIRLINE}`, flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
