import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VocabCard from './VocabCard.jsx'

beforeAll(() => {
  globalThis.window = { innerWidth: 1280, addEventListener() {}, removeEventListener() {} }
})

const WORD = { id: 'w1', kanji: '経験', kana: 'けいけん', english: 'experience', listKey: 'x' }

// Both faces are rendered at once (the flip is a CSS transform), so the two
// halves of the markup are inspected separately.
function faces(showFurigana) {
  const html = renderToStaticMarkup(
    <VocabCard word={WORD} flipped={false} onFlip={() => {}} animate={false} reviewMode="kanji-front" showFurigana={showFurigana} showTranslation showSentence={false} showKanjiMeaning={false} pixelFont={false} />
  )
  const split = html.indexOf('fc-face--back')
  return { front: html.slice(0, split), back: html.slice(split) }
}

const rubies = s => (s.match(/<ruby>/g) ?? []).length

describe('VocabCard furigana', () => {
  // The regression this pins: the back was gated on the same setting as the
  // front, so turning off the front's hint also removed the answer's reading.
  it('always annotates the back, whatever the setting says', () => {
    expect(rubies(faces(false).back)).toBeGreaterThan(0)
    expect(rubies(faces(true).back)).toBeGreaterThan(0)
  })

  it('annotates the front only when the setting is on', () => {
    expect(rubies(faces(false).front)).toBe(0)
    expect(rubies(faces(true).front)).toBeGreaterThan(0)
  })
})
