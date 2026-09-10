import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Button from '../components/Button.jsx'
import { PrimaryCard, ActionsRow, CoverSquare, COVER_SIZE } from './homeCards.jsx'
import { useCoverRotation } from './coverRotation.js'
import { TEXTBOOKS } from '../data/textbooks.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_32, BRAND,
} from '../data/theme.js'

// Dev-only bench for the empty Practice card's rotating cover art (signed
// out, no textbook chosen). "Pop in" shipped to the real card — see
// RotatingCover in homeCards.jsx, which this bench's "2. Pop in" section
// below matches exactly (same hook, same CoverSquare, same classes). Kept
// around as a live comparison against the three variants that weren't
// picked, in case that decision gets revisited. Same pattern as
// ToastLabPage/HomeCardsLabPage: not linked from the dashboard, reached at
// #/dev/cover-rotation.

const ACCENT = BRAND
const ROTATE_MS = 2600

const COVERS = TEXTBOOKS.filter(book => book.icon && !book.personal)

const VARIANTS = [
  {
    key: 'fade',
    label: '1. Crossfade',
    description: 'The incoming cover dissolves in as the outgoing one dissolves out. Safest, most understated — nothing moves, only opacity.',
    enterClass: 'cover-fade-enter',
    exitClass: 'cover-fade-exit',
  },
  {
    key: 'pop',
    label: '2. Pop in — shipped',
    description: 'The new cover springs up from slightly small-and-faded to full size while the old one softens away underneath — the "pop in and replace" version, live on the real card now.',
    enterClass: 'cover-pop-enter',
    exitClass: 'cover-pop-exit',
  },
  {
    key: 'slide',
    label: '3. Slide up',
    description: 'The new cover rises into place from just below its resting spot as the old one lifts out just above it, like a small conveyor.',
    enterClass: 'cover-slide-enter',
    exitClass: 'cover-slide-exit',
  },
  {
    key: 'flip',
    label: '4. Card flip',
    description: 'The square flips on its vertical axis to reveal the next cover on its "other face" — leans into the flashcard theme. The most drastic of the four.',
    enterClass: 'cover-flip-enter',
    exitClass: 'cover-flip-exit',
  },
]

function VariantSection({ variant }) {
  const { current, outgoing, advanceNow } = useCoverRotation(COVERS.length, ROTATE_MS)

  return (
    <div style={{ marginBottom: SPACE_32 }}>
      <SectionHeader title={variant.label} />
      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: SPACE_16, maxWidth: 560, lineHeight: 1.5 }}>
        {variant.description}
      </div>
      <div style={{ display: 'flex', gap: SPACE_32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Actual size, in the real card</div>
          <div style={{ width: 400 }}>
            <PrimaryCard
              accent={ACCENT}
              title="Practice"
              subtitle="Drill words from your study materials"
              cover={<CoverSquare covers={COVERS} current={current} outgoing={outgoing} enterClass={variant.enterClass} exitClass={variant.exitClass} />}
              actions={<ActionsRow><Button size="lg">Choose word list</Button></ActionsRow>}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Magnified</div>
          <div style={{ background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: SPACE_16, display: 'inline-block' }}>
            <CoverSquare covers={COVERS} current={current} outgoing={outgoing} enterClass={variant.enterClass} exitClass={variant.exitClass} size={220} />
          </div>
          <div style={{ marginTop: SPACE_12 }}>
            <Button variant="ghost" size="sm" onClick={advanceNow}>Advance now</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoverRotationLabPage() {
  return (
    <div style={{ width: '100vw', height: '100dvh', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT, overflow: 'hidden' }}>
      <PageHeader crumbs={[{ label: 'Lantern', href: '#/' }, { label: 'Cover rotation lab' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: 8 }}>
            Empty Practice card — rotating cover exploration
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 28, lineHeight: 1.5 }}>
            The empty Practice card (signed out, no textbook chosen) rotates through the available
            covers one at a time inside the same {COVER_SIZE}×{COVER_SIZE} square every other cover
            occupies, instead of the horizontal marquee it used to show. &ldquo;Pop in&rdquo; is what
            shipped; these four sections compare it against the alternatives considered. Each rotates
            on its own {(ROTATE_MS / 1000).toFixed(1)}s timer; use &ldquo;Advance now&rdquo; to trigger
            a swap on demand.
          </div>
          {VARIANTS.map(v => <VariantSection key={v.key} variant={v} />)}
        </div>
      </main>
    </div>
  )
}
