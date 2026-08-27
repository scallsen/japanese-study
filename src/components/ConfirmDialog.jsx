import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_HEADING } from '../data/theme.js'

const SURFACE = '#2A2A2A'
const DANGER = '#f87171'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(380px, 90vw)',
        background: SURFACE,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        zIndex: 51,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        color: TEXT,
        padding: '20px 20px 16px',
      }}>
        {title && <div style={{ fontSize: FS_HEADING, color: TEXT, marginBottom: 10 }}>{title}</div>}
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="confirm-dialog-cancel-btn"
            style={{
              padding: '8px 16px',
              fontSize: FS_BASE,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              background: 'rgba(255,255,255,0.05)',
              color: TEXT,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="confirm-dialog-confirm-btn"
            style={{
              padding: '8px 16px',
              fontSize: FS_BASE,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              background: danger ? 'rgba(192,57,43,0.15)' : 'rgba(58,189,164,0.18)',
              color: danger ? DANGER : '#3ABDA4',
              border: `1px solid ${danger ? 'rgba(192,57,43,0.4)' : 'rgba(58,189,164,0.45)'}`,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
