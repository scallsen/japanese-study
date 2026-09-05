import { useState, useEffect } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import TextInput from './TextInput.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { AUTH_PROVIDERS } from '../data/authProviders.js'
import { TEXT_MUTED, FS_BASE, FS_SM, SPACE_8, SPACE_12, SPACE_16, DANGER } from '../data/theme.js'

export default function SignInDialog({ open, onClose, onProvider, onEmail }) {
  const isMobile = useIsMobile()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // A dialog reopened after a failed or completed attempt should start clean,
  // not show the previous attempt's error or "check your email" state.
  useEffect(() => {
    if (open) {
      setSent(false)
      setBusy(false)
      setError(null)
    }
  }, [open])

  async function handleProvider(id) {
    setError(null)
    setBusy(true)
    const { error: err } = (await onProvider(id)) ?? {}
    // On success the browser is already navigating away, so only the failure
    // path needs to restore the button.
    if (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function handleEmail() {
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    setBusy(true)
    const { error: err } = (await onEmail(trimmed)) ?? {}
    setBusy(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <Modal open={open} onClose={onClose} title="Sign in" size="sm" isMobile={isMobile}>
      {sent ? (
        <div style={{ fontSize: FS_BASE, lineHeight: 1.6 }}>
          Check your email for a sign-in link.
          <div style={{ color: TEXT_MUTED, fontSize: FS_SM, marginTop: SPACE_8 }}>
            Sent to {email.trim()}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_12 }}>
          {AUTH_PROVIDERS.map(p => (
            <Button key={p.id} variant="neutral" fullWidth disabled={busy} onClick={() => handleProvider(p.id)}>
              Continue with {p.label}
            </Button>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8, color: TEXT_MUTED, fontSize: FS_SM }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            or
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          <TextInput
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            disabled={busy}
            autoComplete="email"
            onKeyDown={e => { if (e.key === 'Enter') handleEmail() }}
          />
          <Button fullWidth disabled={busy || !email.trim()} onClick={handleEmail}>
            Send sign-in link
          </Button>
          <div style={{ color: TEXT_MUTED, fontSize: FS_SM, lineHeight: 1.5 }}>
            We&rsquo;ll email you a link &mdash; no password needed.
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: DANGER, fontSize: FS_SM, marginTop: SPACE_16, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </Modal>
  )
}
