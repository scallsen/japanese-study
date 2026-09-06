import Modal from './Modal.jsx'
import Button from './Button.jsx'
import { FS_BASE, TEXT_MUTED } from '../data/theme.js'

// The "advance past this chapter?" prompt — opens when unsent words exist,
// via useTextbookAdvance's `gate`. Cancel is the Modal's own header × (aborts
// the advance entirely, tracker stays put) — distinct from the footer's Skip,
// which does advance, just without sending. Per the concept bench, that's
// the whole footer: no separate Cancel button.
export default function SrsGateDialog({ gate, chapterLabel, unsentCount, totalCount, onCancel, onSkip, onSend, isMobile }) {
  if (!gate) return null
  return (
    <Modal
      open
      onClose={onCancel}
      title={`Send ${chapterLabel} to the SRS first?`}
      size="sm"
      isMobile={isMobile}
      footer={
        <>
          <Button variant="neutral" onClick={onSkip}>Skip</Button>
          <Button onClick={onSend}>Add {unsentCount} to SRS</Button>
        </>
      }
    >
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>
        {unsentCount} of {totalCount} words from {chapterLabel} aren&apos;t in your review queue.
        Once you move on to {gate.toLabel} they&apos;re easy to forget about.
      </div>
    </Modal>
  )
}
