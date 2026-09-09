import { useEffect, useState } from 'react'
import Notice from './Notice.jsx'
import Button from './Button.jsx'
import { useTranslateDetection } from '../hooks/useTranslateDetection.js'
import { SPACE_8 } from '../data/theme.js'

// Global, route-independent overlay (mounted once in main.jsx, not tied to
// any one page) — index.html's notranslate hint stops Chrome's automatic
// prompt, but a learner can still invoke "Translate to..." manually, which
// silently corrupts the Japanese content this app exists to teach. This is
// the fallback: catch that state and tell them how to undo it.
export default function TranslateNotice() {
  const translated = useTranslateDetection()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (translated) setDismissed(false)
  }, [translated])

  if (!translated || dismissed) return null

  return (
    <Notice
      tone="warning"
      title="Your browser is translating this page"
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 460,
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE_8, alignItems: 'flex-start' }}>
        <div>
          This can scramble the Japanese text the app is teaching. Right-click the
          page and choose &ldquo;Show original&rdquo; to turn translation off.
        </div>
        <Button variant="ghost-muted" size="sm" onClick={() => setDismissed(true)}>Dismiss</Button>
      </div>
    </Notice>
  )
}
