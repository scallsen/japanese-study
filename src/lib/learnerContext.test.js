import { describe, it, expect } from 'vitest'
import { State } from 'ts-fsrs'
import { buildLearnerContext } from './learnerContext.js'

const WORD_DATA = [
  { id: 'a-1', kanji: '魚', kana: 'さかな', english: 'fish', listKey: 'nsm-n3-w1d1' },
  { id: 'a-2', kanji: '勉強', kana: 'べんきょう', english: 'study', listKey: 'nsm-n3-w1d2' },
  { id: 'a-3', kanji: 'それ', kana: 'それ', english: 'that', listKey: 'nsm-n3-w1d1' },
]

const CARDS = [
  { id: 'c1', deckId: 'imported', front: '走る', kana: 'はしる', back: 'to run', state: State.Review, stability: 30 },
  { id: 'c2', deckId: 'imported', front: '青い', back: 'blue', state: State.Learning, stability: 2 },
  { id: 'c3', deckId: 'imported', front: '新しい', back: 'new', state: State.New, stability: 0 },
  { id: 'c4', deckId: 'imported', front: '古い', back: 'old', state: State.Review, stability: 5, suspended: true },
  { id: 'c5', deckId: 'keigo', front: 'いただく', back: 'to receive (humble)', state: State.Review, stability: 40 },
]

describe('buildLearnerContext — vocab-list', () => {
  it('filters by a single listKey', () => {
    const ctx = buildLearnerContext('vocab-list', 'nsm-n3-w1d1', { wordData: WORD_DATA })
    expect(ctx.wordCount).toBe(2)
    expect(ctx.text).toContain('魚 (さかな) — fish')
    expect(ctx.text).not.toContain('勉強')
  })

  it('expands a hierarchical source id to all its sublists', () => {
    const ctx = buildLearnerContext('vocab-list', 'nsm-n3', { wordData: WORD_DATA })
    expect(ctx.wordCount).toBe(3)
    expect(ctx.text).toContain('勉強 (べんきょう) — study')
  })

  it('omits the reading when it matches the display form', () => {
    const ctx = buildLearnerContext('vocab-list', 'nsm-n3-w1d1', { wordData: WORD_DATA })
    expect(ctx.text).toContain('それ — that')
    expect(ctx.text).not.toContain('それ (それ)')
  })

  it('includes the word count and grammar level', () => {
    const ctx = buildLearnerContext('vocab-list', 'nsm-n3-w1d1', { wordData: WORD_DATA })
    expect(ctx.text).toContain('(2 words)')
    expect(ctx.text).toContain('JLPT N3')
  })

  it('omits the grammar line when grammarLevel is null', () => {
    const ctx = buildLearnerContext('vocab-list', 'nsm-n3-w1d1', { wordData: WORD_DATA, grammarLevel: null })
    expect(ctx.text).not.toContain('JLPT')
  })
})

describe('buildLearnerContext — srs-deck', () => {
  it('filters by deckId and skips suspended cards', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS })
    expect(ctx.wordCount).toBe(3)
    expect(ctx.text).not.toContain('古い')
    expect(ctx.text).not.toContain('いただく')
  })

  it('maturity "seen" excludes New cards', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS, maturity: 'seen' })
    expect(ctx.wordCount).toBe(2)
    expect(ctx.text).not.toContain('新しい')
  })

  it('maturity "graduated" keeps only Review-state cards', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS, maturity: 'graduated' })
    expect(ctx.wordCount).toBe(1)
    expect(ctx.text).toContain('走る (はしる) — to run')
  })

  it('applies a minimum stability floor', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS, maturity: 'all', minStabilityDays: 10 })
    expect(ctx.wordCount).toBe(1)
    expect(ctx.text).toContain('走る')
  })

  it('uses the kana field as reading when present', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS })
    expect(ctx.text).toContain('走る (はしる) — to run')
    expect(ctx.text).toContain('青い — blue')
  })

  it('skips cards without resolved content', () => {
    const cards = [...CARDS, { id: 'c6', deckId: 'imported', state: State.New }]
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards })
    expect(ctx.wordCount).toBe(3)
  })
})

describe('buildLearnerContext — general', () => {
  it('caps the list with maxWords', () => {
    const ctx = buildLearnerContext('srs-deck', 'imported', { cards: CARDS, maxWords: 1 })
    expect(ctx.wordCount).toBe(1)
    expect(ctx.text).toContain('(1 words)')
  })

  it('throws on an unknown sourceType', () => {
    expect(() => buildLearnerContext('nope', 'x')).toThrow(/sourceType/)
  })
})
