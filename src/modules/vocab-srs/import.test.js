import { describe, it, expect } from 'vitest'
import { parseAnkiExport } from './import.js'
import { State } from './srs.js'

describe('parseAnkiExport', () => {
  it('skips lines starting with #', () => {
    const tsv = `# comment\ndog\tinu\n# another comment\ncat\tneko`
    const cards = parseAnkiExport(tsv)
    expect(cards.length).toBe(2)
    expect(cards.every(c => !c.front.startsWith('#'))).toBe(true)
  })

  it('parses tab-separated front and back correctly', () => {
    const [card] = parseAnkiExport(`dog\tinu - a domestic animal`)
    expect(card.front).toBe('dog')
    expect(card.back).toBe('inu - a domestic animal')
  })

  it('deduplicates against existing IDs', () => {
    const tsv = `dog\tinu\ncat\tneko`
    const cards = parseAnkiExport(tsv, ['anki-dog'])
    expect(cards.length).toBe(1)
    expect(cards[0].front).toBe('cat')
  })

  it('returns a valid card shape for each row', () => {
    const tsv = `dog\tinu\ncat\tneko`
    const cards = parseAnkiExport(tsv)
    expect(cards.length).toBe(2)
    for (const card of cards) {
      expect(card).toHaveProperty('id')
      expect(card).toHaveProperty('front')
      expect(card).toHaveProperty('back')
      expect(card).toHaveProperty('state')
      expect(card).toHaveProperty('due')
      expect(card.state).toBe(State.New)
      expect(card.source).toBe('imported')
      expect(card.deckId).toBe('imported')
      expect(typeof card.addedAt).toBe('number')
    }
  })
})
