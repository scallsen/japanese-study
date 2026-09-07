import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CONTENT_HEADING, SPACE_8, SPACE_16, SPACE_24 } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

/**
 * Renders a deliberately small subset of Markdown: `#`/`##` headings,
 * paragraphs, `-` bullet lists, `**bold**`, and `[text](url)` links.
 *
 * A subset rather than a dependency because the only documents rendered here
 * are ones in this repo, whose formatting we control. If a document ever needs
 * more than this — tables, images, nested lists, code fences — add a real
 * Markdown library rather than growing this, which is exactly the point at
 * which a hand-rolled parser starts quietly getting things wrong.
 */

// Splits on the inline constructs, keeping the delimiters, so each piece can be
// classified by its own shape rather than by position.
function renderInline(text, accent) {
  const pieces = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return pieces.filter(Boolean).map((piece, i) => {
    const bold = piece.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={i} style={{ color: TEXT, fontWeight: 'normal' }}>{bold[1]}</strong>
    const link = piece.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer" style={{ color: accent }}>
          {link[1]}
        </a>
      )
    }
    return <span key={i}>{piece}</span>
  })
}

export default function Markdown({ source }) {
  const accent = useAccent()
  const blocks = []
  let list = null

  function flushList() {
    if (!list) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: `0 0 ${SPACE_16}px`, paddingLeft: SPACE_24 }}>
        {list.map((item, i) => (
          <li key={i} style={{ marginBottom: SPACE_8, lineHeight: 1.6 }}>{renderInline(item, accent)}</li>
        ))}
      </ul>
    )
    list = null
  }

  // Blank-line-separated blocks, with soft-wrapped lines rejoined so a
  // paragraph written across several source lines renders as one.
  for (const raw of source.split('\n\n')) {
    const block = raw.trim()
    if (!block) continue

    if (block.startsWith('- ')) {
      list = block.split('\n').map(l => l.replace(/^-\s*/, '').trim())
      flushList()
      continue
    }
    flushList()

    const heading = block.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      blocks.push(
        <div
          key={blocks.length}
          style={{
            fontSize: level === 1 ? FS_CONTENT_HEADING : FS_BASE,
            color: TEXT,
            textTransform: level > 1 ? 'uppercase' : 'none',
            letterSpacing: level > 1 ? '0.08em' : TRACKING,
            margin: `${blocks.length === 0 ? 0 : SPACE_24}px 0 ${SPACE_8}px`,
          }}
        >
          {heading[2]}
        </div>
      )
      continue
    }

    blocks.push(
      <p key={blocks.length} style={{ margin: `0 0 ${SPACE_16}px`, lineHeight: 1.6, color: TEXT_MUTED }}>
        {renderInline(block.replace(/\n/g, ' '), accent)}
      </p>
    )
  }
  flushList()

  return (
    <div style={{ fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, color: TEXT_MUTED }}>
      {blocks}
    </div>
  )
}
