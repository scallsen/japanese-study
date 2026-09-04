import { describe, it, expect } from 'vitest'
import { resolveTextbookState } from './textbookProgress.js'

const count = id => (id.startsWith('nsm-n3') ? 20 : 0)

describe('resolveTextbookState', () => {
  it('returns null when no textbook is chosen', () => {
    expect(resolveTextbookState(null, count)).toBeNull()
    expect(resolveTextbookState({ sublists: {} }, count)).toBeNull()
    expect(resolveTextbookState({ textbook: { id: 'nope' } }, count)).toBeNull()
  })

  it('starts at the first chapter when nothing is drilled', () => {
    const s = resolveTextbookState({ textbook: { id: 'nsm-n3', currentChapterId: null } }, count)
    expect(s.current.id).toBe('nsm-n3-w1d1')
    expect(s.current.drilled).toBe(false)
    expect(s.next.id).toBe('nsm-n3-w1d2')
    expect(s.doneCount).toBe(0)
    expect(s.hasWords).toBe(true)
  })

  it('falls through to the first undrilled chapter without a pointer', () => {
    const s = resolveTextbookState({
      textbook: { id: 'nsm-n3', currentChapterId: null },
      sublists: {
        'nsm-n3-w1d1': { 'kanji-front': { lastReviewed: '2026-09-01T00:00:00Z', correct: 18, total: 20 } },
        'nsm-n3-w1d2': { lastReviewed: '2026-09-02T00:00:00Z', correct: 20, total: 20 },
      },
    }, count)
    expect(s.current.id).toBe('nsm-n3-w1d3')
    expect(s.doneCount).toBe(2)
    expect(s.wordsDrilled).toBe(40)
    expect(s.chapters[1].lastReviewed).toBe('2026-09-02T00:00:00Z')
  })

  it('honours the pointer and exposes drilled state for Continue / Start next', () => {
    const s = resolveTextbookState({
      textbook: { id: 'nsm-n3', currentChapterId: 'nsm-n3-w2d1' },
      sublists: { 'nsm-n3-w2d1': { 'kanji-front': { lastReviewed: '2026-09-01T00:00:00Z' } } },
    }, count)
    expect(s.current.id).toBe('nsm-n3-w2d1')
    expect(s.current.drilled).toBe(true)
    expect(s.next.id).toBe('nsm-n3-w2d2')
  })

  it('has no next chapter at the end of the book', () => {
    const s = resolveTextbookState({ textbook: { id: 'nsm-n3', currentChapterId: 'nsm-n3-w4d3' } }, count)
    expect(s.current.id).toBe('nsm-n3-w4d3')
    expect(s.next).toBeNull()
  })

  it('reports no words for a book without data', () => {
    const s = resolveTextbookState({ textbook: { id: 'genki-1', currentChapterId: null } }, count)
    expect(s.hasWords).toBe(false)
    expect(s.current.label).toBe('Lesson 1')
  })
})
