import PageHeader from './PageHeader.jsx'
import Button from './Button.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE } from '../data/theme.js'

const BG = '#1E1E1E'

// Full-page "sign in to use this" screen for modules whose progress lives
// only in Supabase. VocabSrsModule and VocabSrsBrowsePage rendered this
// identical block with a hand-styled accent button; the button is now the
// shared primary in the ambient module accent.
export default function SignInGate({ crumbs, title, subtitle, onSignIn }) {
  return (
    <div style={{ width: '100vw', height: '100dvh', background: BG, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT }}>
      <PageHeader crumbs={crumbs} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: FS_BASE, color: TEXT }}>{title}</div>
        {subtitle && <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 8 }}>{subtitle}</div>}
        <Button size="lg" onClick={onSignIn}>Sign in with GitHub</Button>
      </div>
    </div>
  )
}
