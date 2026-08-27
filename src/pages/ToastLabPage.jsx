import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Toast from '../components/Toast.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING, FS_HEADING } from '../data/theme.js'

const BG = '#1E1E1E'
const SURFACE = '#2A2A2A'
const ACCENT = '#3ABDA4'

const VARIANTS = [
  { key: 'bottom-bar', title: '1. Bottom, full width', description: 'A full-width bar pinned to the bottom edge of the viewport.' },
  { key: 'bottom-card', title: '2. Bottom, fixed width', description: 'A compact rounded card, centered near the bottom edge.' },
  { key: 'top-bar', title: '3. Top, full width', description: 'A full-width bar directly under the header, reading as an extension of it — overlays page content instead of pushing it down.' },
  { key: 'top-card', title: '4. Top, fixed width', description: 'A compact rounded card, centered just under the header.' },
]

function Section({ title, description, onTrigger, log }) {
  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: FS_HEADING, color: TEXT, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 16, lineHeight: 1.5, maxWidth: 560 }}>{description}</div>
      <button
        onClick={onTrigger}
        className="done-btn"
        style={{
          padding: '8px 16px', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING,
          background: 'rgba(58,189,164,0.15)', border: '1px solid rgba(58,189,164,0.4)',
          borderRadius: 6, color: ACCENT, cursor: 'pointer', marginBottom: log ? 10 : 0,
        }}
      >
        Trigger toast
      </button>
      {log && <div style={{ fontSize: FS_CAPTION, color: ACCENT }}>{log}</div>}
    </div>
  )
}

export default function ToastLabPage() {
  const [openMap, setOpenMap] = useState({})
  const [logMap, setLogMap] = useState({})

  function trigger(key) {
    setOpenMap(m => ({ ...m, [key]: true }))
    setLogMap(m => ({ ...m, [key]: null }))
  }

  function handleDismiss(key) {
    setOpenMap(m => ({ ...m, [key]: false }))
  }

  function handleUndo(key) {
    setLogMap(m => ({ ...m, [key]: 'Undo clicked — would revert the add.' }))
  }

  return (
    <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT, overflow: 'hidden' }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Toast lab' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: 8 }}>
            Add-confirmation toast — UX comparison
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 28, lineHeight: 1.5 }}>
            Four placement variants for the &ldquo;Added N words to X&rdquo; confirmation, each with an Undo action.
            Trigger more than one at once to compare top vs bottom side by side.
          </div>
          {VARIANTS.map(v => (
            <Section
              key={v.key}
              title={v.title}
              description={v.description}
              onTrigger={() => trigger(v.key)}
              log={logMap[v.key]}
            />
          ))}
        </div>
      </main>

      {VARIANTS.map(v => (
        <Toast
          key={v.key}
          open={!!openMap[v.key]}
          variant={v.key}
          message="Added 3 words to Immersion Words."
          actionLabel="Undo"
          onAction={() => handleUndo(v.key)}
          onDismiss={() => handleDismiss(v.key)}
        />
      ))}
    </div>
  )
}
