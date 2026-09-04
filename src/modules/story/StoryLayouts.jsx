import { TokenizedBody } from '../../components/JapaneseReader.jsx'
import { parseDialogue } from './parseDialogue.js'
import { FONT, KANJI_FONT, MINCHO_FONT, TRACKING, BORDER, TEXT, TEXT_MUTED, FS_BASE } from '../../data/theme.js'
import { SURFACE } from './storyUI.jsx'

const LINE_FONT = "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', 'Segoe UI', sans-serif"

// Promoted to src/components/ (round 2) so the News reader can reuse it —
// re-exported here so StoryReviewPage's FORMAT_LAYOUTS lookup and its
// import site are unchanged.
export { default as NewspaperLayout } from '../../components/NewspaperLayout.jsx'

const AVATAR_COLORS = ['#5A8FD4', '#B56AC9', '#4FAF9B', '#CC8A3D']

export function ChatLayout({ title, tokens, vocabMap, onWordClick, showFurigana, activeIdx, isMobile }) {
  const lines = parseDialogue(tokens)
  const speakers = []
  for (const line of lines) {
    if (line.speaker && !speakers.includes(line.speaker)) speakers.push(line.speaker)
  }
  const rightSpeaker = speakers[1] ?? null

  return (
    <div style={{
      background: '#26313D',
      borderRadius: 10,
      padding: isMobile ? '0 12px 18px' : '0 20px 24px',
      overflow: 'hidden',
      fontFamily: LINE_FONT,
      letterSpacing: 'normal',
    }}>
      <div style={{
        textAlign: 'center',
        fontSize: FS_BASE,
        color: TEXT,
        padding: '12px 0',
        margin: isMobile ? '0 -12px 16px' : '0 -20px 16px',
        background: 'rgba(0,0,0,0.25)',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lines.map((line, li) => {
          const body = (offset, extra = {}) => (
            <TokenizedBody
              tokens={line.entries.map(e => e.tok)}
              vocabMap={vocabMap}
              onWordClick={(tok, e, i) => onWordClick(tok, e, i + offset)}
              showFurigana={showFurigana}
              activeIdx={activeIdx === null ? null : activeIdx - offset}
              vocabHighlight="rgba(204,138,61,0.35)"
              {...extra}
            />
          )
          const offset = line.entries.length ? line.entries[0].gi : 0

          if (!line.speaker) {
            return (
              <div key={li} style={{
                alignSelf: 'center',
                fontSize: 13,
                color: TEXT_MUTED,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 10,
                padding: '4px 14px',
                lineHeight: showFurigana ? 2.2 : 1.8,
                maxWidth: '90%',
                textAlign: 'center',
              }}>
                {body(offset)}
              </div>
            )
          }

          const isRight = line.speaker === rightSpeaker
          const speakerIdx = speakers.indexOf(line.speaker)
          const avatarColor = AVATAR_COLORS[speakerIdx % AVATAR_COLORS.length]

          return (
            <div key={li} style={{
              display: 'flex',
              flexDirection: isRight ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
            }}>
              <div style={{
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: '50%',
                background: avatarColor,
                color: '#F5F5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                marginBottom: 2,
              }}>
                {line.speaker.slice(0, 1)}
              </div>
              <div style={{ maxWidth: isMobile ? '78%' : '70%' }}>
                <div style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  marginBottom: 3,
                  textAlign: isRight ? 'right' : 'left',
                }}>
                  {line.speaker}
                </div>
                <div style={{
                  background: isRight ? '#3E8E5A' : '#3B4652',
                  color: '#F2F2F2',
                  borderRadius: 14,
                  borderBottomRightRadius: isRight ? 4 : 14,
                  borderBottomLeftRadius: isRight ? 14 : 4,
                  padding: '9px 13px',
                  fontSize: 16,
                  lineHeight: showFurigana ? 2.2 : 1.7,
                }}>
                  {body(offset, { rtColor: 'rgba(255,255,255,0.55)', hoverBg: 'rgba(255,255,255,0.16)' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const NOTEBOOK_BG = '#EFE9D8'
const NOTEBOOK_LINE = 'rgba(28,26,23,0.12)'

// Diary entries start with a date line on its own single-newline-terminated
// line (enforced in the generation prompt) — split it out to render as a
// dated header above the entry body, like a notebook page.
export function DiaryLayout({ title, tokens, vocabMap, onWordClick, showFurigana, activeIdx, isMobile }) {
  const breakIdx = tokens.findIndex(t => t.t === '\n')
  const hasHeader = breakIdx > 0
  const headerTokens = hasHeader ? tokens.slice(0, breakIdx) : []
  const bodyTokens = hasHeader ? tokens.slice(breakIdx + 1) : tokens
  const bodyOffset = hasHeader ? breakIdx + 1 : 0

  const section = (sectionTokens, offset) => (
    <TokenizedBody
      tokens={sectionTokens}
      vocabMap={vocabMap}
      onWordClick={(tok, e, i) => onWordClick(tok, e, i + offset)}
      showFurigana={showFurigana}
      activeIdx={activeIdx === null ? null : activeIdx - offset}
      vocabHighlight="rgba(178,88,32,0.28)"
      hoverBg="rgba(28,26,23,0.1)"
      rtColor="#6B6558"
    />
  )

  return (
    <div style={{
      background: NOTEBOOK_BG,
      backgroundImage: `repeating-linear-gradient(${NOTEBOOK_BG}, ${NOTEBOOK_BG} 31px, ${NOTEBOOK_LINE} 32px)`,
      backgroundPosition: '0 66px',
      color: '#1C1A17',
      borderRadius: 4,
      padding: isMobile ? '20px 20px 26px 38px' : '26px 34px 34px 54px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        left: isMobile ? 20 : 30,
        top: 0,
        bottom: 0,
        width: 1,
        background: 'rgba(178,88,32,0.35)',
      }} />
      <div style={{ fontFamily: KANJI_FONT, fontSize: FS_BASE, color: '#8A5A2B', marginBottom: 12 }}>
        {title}
      </div>
      {hasHeader && (
        <div style={{ fontFamily: KANJI_FONT, fontSize: 14, letterSpacing: '0.04em', color: '#6B5A3E', marginBottom: 14, textAlign: 'right' }}>
          {section(headerTokens, 0)}
        </div>
      )}
      <div style={{
        fontFamily: KANJI_FONT,
        fontSize: isMobile ? 16 : 17,
        lineHeight: showFurigana ? 2.3 : 1.95,
        whiteSpace: 'pre-wrap',
      }}>
        {section(bodyTokens, bodyOffset)}
      </div>
    </div>
  )
}

const INTERVIEWER_ACCENT = '#CC8A3D'
const SUBJECT_ACCENT = '#3ABDA4'

// Reuses parseDialogue (same 名前「セリフ」 convention as the dialogue format)
// but renders as a printed Q&A column instead of chat bubbles.
export function InterviewLayout({ title, tokens, vocabMap, onWordClick, showFurigana, activeIdx, isMobile }) {
  const lines = parseDialogue(tokens)
  const speakers = []
  for (const line of lines) {
    if (line.speaker && !speakers.includes(line.speaker)) speakers.push(line.speaker)
  }

  return (
    <div style={{
      background: SURFACE,
      borderRadius: 8,
      padding: isMobile ? '18px 16px 22px' : '24px 30px 30px',
      boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
    }}>
      <div style={{
        textAlign: 'center',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        fontSize: FS_BASE,
        color: TEXT,
        paddingBottom: 14,
        marginBottom: 20,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {lines.map((line, li) => {
          const offset = line.entries.length ? line.entries[0].gi : 0
          const body = (
            <TokenizedBody
              tokens={line.entries.map(e => e.tok)}
              vocabMap={vocabMap}
              onWordClick={(tok, e, i) => onWordClick(tok, e, i + offset)}
              showFurigana={showFurigana}
              activeIdx={activeIdx === null ? null : activeIdx - offset}
              vocabHighlight="rgba(204,138,61,0.35)"
            />
          )

          if (!line.speaker) {
            return (
              <div key={li} style={{
                fontSize: 13,
                color: TEXT_MUTED,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: showFurigana ? 2.2 : 1.8,
              }}>
                {body}
              </div>
            )
          }

          const isInterviewer = speakers.indexOf(line.speaker) === 0
          const accent = isInterviewer ? INTERVIEWER_ACCENT : SUBJECT_ACCENT

          return (
            <div key={li} style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 14 }}>
              <div style={{
                fontSize: 12,
                fontFamily: FONT,
                letterSpacing: TRACKING,
                textTransform: 'uppercase',
                color: accent,
                marginBottom: 4,
              }}>
                {line.speaker}
              </div>
              <div style={{ fontSize: 16, lineHeight: showFurigana ? 2.2 : 1.8 }}>
                {body}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LETTER_BG = '#F3ECDD'

export function LetterLayout({ title, tokens, vocabMap, onWordClick, showFurigana, activeIdx, isMobile }) {
  return (
    <div style={{
      background: LETTER_BG,
      color: '#1C1A17',
      borderRadius: 6,
      padding: isMobile ? '22px 20px 28px' : '30px 40px 36px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
      position: 'relative',
    }}>
      <div style={{
        fontFamily: MINCHO_FONT,
        fontSize: isMobile ? 15 : 16,
        color: '#8A5A2B',
        marginBottom: 22,
        maxWidth: isMobile ? '65%' : '75%',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: MINCHO_FONT,
        fontSize: isMobile ? 16 : 17,
        lineHeight: showFurigana ? 2.3 : 1.95,
        whiteSpace: 'pre-wrap',
        borderTop: '1px solid rgba(28,26,23,0.2)',
        paddingTop: 20,
      }}>
        <TokenizedBody
          tokens={tokens}
          vocabMap={vocabMap}
          onWordClick={onWordClick}
          showFurigana={showFurigana}
          activeIdx={activeIdx}
          vocabHighlight="rgba(178,88,32,0.28)"
          hoverBg="rgba(28,26,23,0.1)"
          rtColor="#6B6558"
        />
      </div>
    </div>
  )
}

const POSTCARD_BG = '#F7F3E8'
const POSTCARD_INK = '#2A2620'
const STAMP_BG = '#C9784A'

// Perforated stamp edge: four thin strips, each a repeating radial-gradient
// of the card's own background color, layered on top of the stamp face to
// "punch" scalloped notches — cheaper and more reliable across browsers than
// a mask-image approach, and needs no image asset (avoids any resemblance to
// a real, copyrighted postage stamp design).
function Stamp() {
  // Each strip straddles the face's true boundary (half outside the box,
  // half overlapping the face), so the visible "bite" is whichever half
  // overlaps the colored face — the overhang beyond the box just blends
  // into the postcard's own background behind it.
  const notchImage = `radial-gradient(circle 3.5px, ${POSTCARD_BG} 3.5px, transparent 3.8px)`
  const notch = (edgeStyle) => (
    <div style={{
      position: 'absolute',
      backgroundImage: notchImage,
      backgroundSize: '10px 10px',
      ...edgeStyle,
    }} />
  )
  return (
    <div style={{ position: 'relative', width: 48, height: 60, flexShrink: 0 }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(160deg, ${STAMP_BG}, #7A3D22)`,
        border: '1px solid rgba(0,0,0,0.25)',
      }} />
      {notch({ top: -4, left: 0, right: 0, height: 8, backgroundRepeat: 'repeat-x' })}
      {notch({ bottom: -4, left: 0, right: 0, height: 8, backgroundRepeat: 'repeat-x' })}
      {notch({ top: 0, bottom: 0, left: -4, width: 8, backgroundRepeat: 'repeat-y' })}
      {notch({ top: 0, bottom: 0, right: -4, width: 8, backgroundRepeat: 'repeat-y' })}
    </div>
  )
}

function PostalCodeBoxes() {
  const box = (key) => (
    <div key={key} style={{ width: 13, height: 16, border: `1px solid ${POSTCARD_INK}`, borderRadius: 1 }} />
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: KANJI_FONT, fontSize: 13, color: POSTCARD_INK }}>〒</span>
      <div style={{ display: 'flex', gap: 2 }}>{[0, 1, 2].map(box)}</div>
      <span style={{ color: POSTCARD_INK, fontSize: 12 }}>—</span>
      <div style={{ display: 'flex', gap: 2 }}>{[0, 1, 2, 3].map(box)}</div>
    </div>
  )
}

// Portrait hagaki layout. The postal-code row and stamp stay horizontal (as
// on a real postcard) while the message itself renders in vertical-rl
// columns flowing right to left — the message area gets a fixed height and
// horizontal scroll instead of the app's usual vertical scroll, since new
// content in vertical writing adds columns (width), not height.
export function PostcardLayout({ title, tokens, vocabMap, onWordClick, showFurigana, activeIdx, isMobile }) {
  return (
    <div style={{
      background: POSTCARD_BG,
      color: POSTCARD_INK,
      borderRadius: 4,
      width: isMobile ? '100%' : 380,
      maxWidth: '100%',
      margin: '0 auto',
      padding: isMobile ? '16px 16px 20px' : '20px 22px 24px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <PostalCodeBoxes />
        <Stamp />
      </div>
      <div style={{ fontFamily: KANJI_FONT, fontSize: 13, color: '#8A5A2B', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        // width bounds the block axis (the one that grows to fit more
        // columns in vertical-rl, the way a paragraph's height grows to fit
        // more lines) — without it the container just expands past the
        // card instead of triggering overflowX's scrollbar.
        width: '100%',
        height: isMobile ? 300 : 340,
        overflowX: 'auto',
        overflowY: 'hidden',
        fontFamily: KANJI_FONT,
        fontSize: isMobile ? 16 : 17,
        lineHeight: showFurigana ? 2.4 : 2,
        boxSizing: 'border-box',
        paddingBottom: 8,
      }}>
        <TokenizedBody
          tokens={tokens}
          vocabMap={vocabMap}
          onWordClick={onWordClick}
          showFurigana={showFurigana}
          activeIdx={activeIdx}
          vocabHighlight="rgba(178,88,32,0.28)"
          hoverBg="rgba(28,26,23,0.1)"
          rtColor="#6B6558"
        />
      </div>
    </div>
  )
}
