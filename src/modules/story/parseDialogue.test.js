import { describe, it, expect } from 'vitest'
import { parseDialogue } from './parseDialogue.js'

const tok = (t, w = false) => ({ t, r: null, w, b: null })

describe('parseDialogue', () => {
  it('splits speaker lines into speaker + utterance entries', () => {
    const tokens = [
      tok('田中', true), tok('「'), tok('おはよう', true), tok('」'), tok('\n'),
      tok('佐藤', true), tok('「'), tok('元気', true), tok('？'), tok('」'),
    ]
    const lines = parseDialogue(tokens)
    expect(lines).toHaveLength(2)
    expect(lines[0].speaker).toBe('田中')
    expect(lines[0].entries.map(e => e.tok.t).join('')).toBe('おはよう')
    expect(lines[1].speaker).toBe('佐藤')
    expect(lines[1].entries.map(e => e.tok.t).join('')).toBe('元気？')
  })

  it('keeps global token indices on entries', () => {
    const tokens = [
      tok('A', true), tok('「'), tok('話', true), tok('」'), tok('\n'),
      tok('B', true), tok('「'), tok('返事', true), tok('」'),
    ]
    const lines = parseDialogue(tokens)
    expect(lines[0].entries[0].gi).toBe(2)
    expect(lines[1].entries[0].gi).toBe(7)
  })

  it('treats lines without brackets as narration', () => {
    const tokens = [
      tok('雨', true), tok('が'), tok('降った', true), tok('\n'),
      tok('田中', true), tok('「'), tok('寒い', true), tok('」'),
    ]
    const lines = parseDialogue(tokens)
    expect(lines[0].speaker).toBeNull()
    expect(lines[0].entries).toHaveLength(3)
    expect(lines[1].speaker).toBe('田中')
  })

  it('strips a trailing colon from the speaker name', () => {
    const tokens = [tok('田中', true), tok('：'), tok('「'), tok('やあ', true), tok('」')]
    expect(parseDialogue(tokens)[0].speaker).toBe('田中')
  })

  it('handles double-newline paragraph tokens', () => {
    const tokens = [
      tok('A', true), tok('「'), tok('一', true), tok('」'), tok('\n\n'),
      tok('B', true), tok('「'), tok('二', true), tok('」'),
    ]
    expect(parseDialogue(tokens)).toHaveLength(2)
  })
})
