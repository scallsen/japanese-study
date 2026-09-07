import { describe, it, expect } from 'vitest'
import { msUntilUtcReset, formatResetCountdown } from './useQuotaResetCountdown.js'

describe('msUntilUtcReset', () => {
  it('counts to the next UTC midnight', () => {
    const now = Date.parse('2026-09-06T19:37:00Z')
    expect(msUntilUtcReset(now)).toBe(Date.parse('2026-09-07T00:00:00Z') - now)
  })

  it('returns a full day at UTC midnight rather than zero', () => {
    expect(msUntilUtcReset(Date.parse('2026-09-06T00:00:00Z'))).toBe(24 * 60 * 60 * 1000)
  })
})

describe('formatResetCountdown', () => {
  it('formats hours and minutes', () => {
    expect(formatResetCountdown((4 * 60 + 23) * 60_000)).toBe('4h 23min')
  })

  it('drops the hour when under one', () => {
    expect(formatResetCountdown(23 * 60_000)).toBe('23min')
  })

  it('drops the minutes when they land on the hour', () => {
    expect(formatResetCountdown(5 * 60 * 60_000)).toBe('5h')
  })

  it('rounds part-minutes up, so it never reads 0min with time left', () => {
    expect(formatResetCountdown(30_000)).toBe('1min')
    expect(formatResetCountdown((4 * 60 + 22) * 60_000 + 30_000)).toBe('4h 23min')
  })
})
