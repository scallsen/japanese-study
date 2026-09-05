import { describe, it, expect } from 'vitest'
import { buildAnkiTsv, buildBackupJson } from './exportData.js'

const card = (over = {}) => ({
  front: '魚', back: 'fish', kana: 'さかな',
  sentence: '魚を食べる。', sentenceEnglish: 'I eat fish.',
  deckId: 'keigo', ...over,
})

describe('buildAnkiTsv', () => {
  it('emits Anki directives so the user need not configure the import by hand', () => {
    const lines = buildAnkiTsv([card()]).split('\n')
    expect(lines[0]).toBe('#separator:tab')
    expect(lines[1]).toBe('#html:false')
    // Tags sit one past the five content columns.
    expect(lines[2]).toBe('#tags column:6')
  })

  it('writes content columns in order, with the deck as the trailing tag', () => {
    const row = buildAnkiTsv([card()], { keigo: 'Keigo Deck' }).split('\n')[3]
    expect(row.split('\t')).toEqual(['魚', 'fish', 'さかな', '魚を食べる。', 'I eat fish.', 'Keigo-Deck'])
  })

  it('flattens tabs and newlines so they cannot shift later columns', () => {
    const row = buildAnkiTsv([card({ back: 'fish\tsea\ncreature' })]).split('\n')[3]
    expect(row.split('\t')).toHaveLength(6)
    expect(row.split('\t')[1]).toBe('fish sea creature')
  })

  it('hyphenates deck names, since Anki splits tags on whitespace', () => {
    const row = buildAnkiTsv([card({ deckId: 'word-import' })], { 'word-import': 'Imported Words' }).split('\n')[3]
    expect(row.split('\t')[5]).toBe('Imported-Words')
  })

  it('falls back to the deck id when no display name is known', () => {
    const row = buildAnkiTsv([card({ deckId: 'keigo' })]).split('\n')[3]
    expect(row.split('\t')[5]).toBe('keigo')
  })

  it('drops cards with no resolved content rather than exporting blank notes', () => {
    const rows = buildAnkiTsv([card(), { front: '', back: '', deckId: 'keigo' }])
      .trim().split('\n').slice(3)
    expect(rows).toHaveLength(1)
  })

  it('leaves missing optional fields empty without collapsing the row', () => {
    const row = buildAnkiTsv([{ front: 'それ', back: 'that', deckId: 'keigo' }]).split('\n')[3]
    expect(row.split('\t')).toEqual(['それ', 'that', '', '', '', 'keigo'])
  })
})

describe('buildBackupJson', () => {
  it('is parseable and carries a format marker for future readers', () => {
    const parsed = JSON.parse(buildBackupJson({
      progress: [{ namespace: 'vocab-srs', payload: { totalReviews: 3 } }],
      stories: [{ id: 'a', title: 'T' }],
      exportedAt: new Date('2026-09-05T00:00:00Z'),
    }))
    expect(parsed.format).toBe('japanese-study-backup@1')
    expect(parsed.exportedAt).toBe('2026-09-05T00:00:00.000Z')
    expect(parsed.progress[0].payload.totalReviews).toBe(3)
    expect(parsed.stories).toHaveLength(1)
  })
})
