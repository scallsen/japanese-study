import Modal from './Modal.jsx'
import Button from './Button.jsx'
import { TEXT_MUTED, FS_BASE } from '../data/theme.js'

// Now a thin composition of Modal + Button rather than its own scrim/panel
// implementation. Public API is unchanged, so every existing call site keeps
// working. Two deliberate visual changes came with the move: the title now
// sits in Modal's standard bordered header (consistent with every other
// overlay), and the danger button's background tint matches its own text
// colour — the old inline style paired an rgba(192,57,43,…) fill with
// #f87171 text, two different reds.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      showClose={false}
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger-outline' : 'accent-outline'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5 }}>{message}</div>
    </Modal>
  )
}
