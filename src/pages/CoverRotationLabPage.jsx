import { useState, useEffect, useRef, useCallback } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import Button from '../components/Button.jsx'
import { PrimaryCard, ActionsRow, COVER_SIZE } from './homeCards.jsx'
import { MODULES } from '../data/modules.js'
import { TEXTBOOKS, COVER_GUTTER_FRACTION } from '../data/textbooks.js'
import {
  FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING,
  SPACE_8, SPACE_12, SPACE_16, SPACE_32,
} from '../data/theme.js'

// Dev-only exploration for the empty Practice card (signed out, no textbook
// chosen). Today that state fills the card body with a horizontal marquee
// of covers drifting past. This bench tries the opposite approach: keep the
// cover art confined to the same top-right square the real TextbookCover
// and ReviewPlaceholder already occupy — so the card's overall shape never
// changes across states — and rotate through the available covers one at a
// time inside it, each swap carrying a small entrance/exit animation. Same
// pattern as ToastLabPage/HomeCardsLabPage: not linked from the dashboard,
// reached at #/dev/cover-rotation. Nothing here is wired into the real
// empty state yet — pick a variant and it gets ported into homeCards.jsx.

const ACCENT = MODULES.find(m => m.id === 'school-vocab').accent
const ROTATE_MS = 2600
const EXIT_MS = 550

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
    label: '2. Pop in',
    description: 'The new cover springs up from slightly small-and-faded to full size while the old one softens away underneath — the "pop in and replace" version.',
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

// One rotation timer per variant section, shared by both the actual-size
// preview (inside the real card) and the magnified swatch next to it, so
// the two never drift out of sync with each other.
function useCoverRotation(count, intervalMs) {
  const [current, setCurrent] = useState(0)
  const [outgoing, setOutgoing] = useState(null) // { index, cycleId } | null
  const cycleRef = useRef(0)
  const timerRef = useRef(null)

  const advance = useCallback(() => {
    setCurrent(prev => {
      const next = (prev + 1) % count
      cycleRef.current += 1
      setOutgoing({ index: prev, cycleId: cycleRef.current })
      return next
    })
  }, [count])

  useEffect(() => {
    timerRef.current = setInterval(advance, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [advance, intervalMs])

  useEffect(() => {
    if (outgoing == null) return
    const t = setTimeout(() => {
      setOutgoing(o => (o && o.cycleId === outgoing.cycleId ? null : o))
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [outgoing])

  function advanceNow() {
    advance()
    clearInterval(timerRef.current)
    timerRef.current = setInterval(advance, intervalMs)
  }

  return { current, outgoing, advanceNow }
}

// Same crop TextbookCover already uses (the 5/32-per-side transparent
// gutter trimmed off), just centered inside a square wrapper instead of
// abutting a rectangular one — so the artwork itself is never distorted or
// cropped any further than it already is everywhere else in the app.
function CoverSquare({ current, outgoing, enterClass, exitClass, size = COVER_SIZE }) {
  const scale = size / COVER_SIZE
  const gutter = COVER_GUTTER_FRACTION * COVER_SIZE
  const artWidth = COVER_SIZE - gutter * 2
  const artLeft = (COVER_SIZE - artWidth) / 2

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, overflow: 'hidden', perspective: 500 }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {outgoing && (
          <img
            key={`out-${outgoing.cycleId}`}
            src={COVERS[outgoing.index].icon}
            alt=""
            className={exitClass}
            style={{ position: 'absolute', top: 0, left: artLeft, width: artWidth, height: COVER_SIZE, imageRendering: 'pixelated' }}
          />
        )}
        <img
          key={`in-${current}`}
          src={COVERS[current].icon}
          alt=""
          className={enterClass}
          style={{ position: 'absolute', top: 0, left: artLeft, width: artWidth, height: COVER_SIZE, imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  )
}

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
              cover={<CoverSquare current={current} outgoing={outgoing} enterClass={variant.enterClass} exitClass={variant.exitClass} />}
              actions={<ActionsRow><Button size="lg">Choose word list</Button></ActionsRow>}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginBottom: SPACE_8 }}>Magnified</div>
          <div style={{ background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: SPACE_16, display: 'inline-block' }}>
            <CoverSquare current={current} outgoing={outgoing} enterClass={variant.enterClass} exitClass={variant.exitClass} size={220} />
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
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Cover rotation lab' }]} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: 8 }}>
            Empty Practice card — rotating cover exploration
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginBottom: 28, lineHeight: 1.5 }}>
            Today, when signed out with no textbook chosen, the Practice card fills its body with a
            horizontal marquee of covers drifting past. These four options try the opposite: keep the
            art confined to the same {COVER_SIZE}×{COVER_SIZE} square the real cover occupies once a
            textbook is chosen — so the card&rsquo;s shape never changes across states — and take turns
            showing one cover at a time inside it. Each rotates on its own {(ROTATE_MS / 1000).toFixed(1)}s
            timer; use &ldquo;Advance now&rdquo; to trigger a swap on demand.
          </div>
          {VARIANTS.map(v => <VariantSection key={v.key} variant={v} />)}
        </div>
      </main>
    </div>
  )
}
