import PageHeader from '../components/PageHeader.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import Markdown from '../components/Markdown.jsx'
// Inlined at build time by Vite, so the page always shows the committed file
// rather than a copy that drifts from it.
import PRIVACY_MD from '../../PRIVACY.md?raw'
import { FONT, TRACKING, TEXT, CONTENT_STANDARD } from '../data/theme.js'

const COLUMN_WIDTH = CONTENT_STANDARD

export default function PrivacyPage() {
  const shell = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
    letterSpacing: TRACKING,
    color: TEXT,
  }

  const scroll = {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  return (
    <div style={shell}>
      <PageHeader crumbs={[{ label: 'Lantern', href: '#/' }, { label: 'Privacy Policy' }]} rightSlot={<AuthSlot />} />
      <div style={scroll}>
        <div style={{ width: '100%', maxWidth: COLUMN_WIDTH }}>
          {/* The document keeps its own H1 so it reads properly as a file on
              GitHub; here the page header already carries the title. */}
          <Markdown source={PRIVACY_MD.replace(/^#\s+.*\n+/, '')} />
        </div>
      </div>
    </div>
  )
}
