import { getStats, getGlobalStats } from './srs.js'

export default {
  id: 'vocab-srs',
  label: 'SRS',
  sublabel: 'Spaced Repetition',
  getStats: (progressData) => {
    if (!progressData) {
      return { primary: 'No active decks', secondary: 'Enable a deck to start' }
    }

    // Old shape: cards is an array
    if (Array.isArray(progressData.cards)) {
      if (!progressData.cards.length) return { primary: 'No deck', secondary: 'Import to start' }
      const stats = getStats(progressData.cards)
      return {
        primary: `${stats.dueToday} due`,
        secondary: `${stats.newAvailable} new · ${stats.learned} learned`,
      }
    }

    // New shape
    const decks = progressData.decks ?? {}
    const cardsObj = progressData.cards ?? {}
    const stats = getGlobalStats(cardsObj, decks)

    if (stats.activeDecks === 0 || stats.totalCards === 0) {
      return { primary: 'No active decks', secondary: 'Enable a deck to start' }
    }

    return {
      primary: `${stats.dueToday} due`,
      secondary: `${stats.activeDecks} active · ${stats.newAvailable} new`,
    }
  },
  href: '#/vocab-srs',
  external: false,
  accent: '#3ABDA4',
  requiresAuth: false,
}
