import { describe, it, expect } from 'vitest'
import { shortenOperatorName } from '../../src/lib/utils/shorten-operator-name'

describe('shortenOperatorName', () => {
  it('shortens "Dive Center" to "DC"', () => {
    expect(shortenOperatorName('Siam Dive Center')).toBe('Siam DC')
  })

  it('shortens "Dive Resort" to "DR"', () => {
    expect(shortenOperatorName('Koh Tao Dive Resort')).toBe('Koh Tao DR')
  })

  it('shortens "Dive Hostel" to "DH"', () => {
    expect(shortenOperatorName('Backpacker Dive Hostel')).toBe('Backpacker DH')
  })

  it('shortens "Diving Center" to "DC"', () => {
    expect(shortenOperatorName('Ocean Diving Center')).toBe('Ocean DC')
  })

  it('returns name unchanged when no matching phrase', () => {
    expect(shortenOperatorName('Blue Planet')).toBe('Blue Planet')
  })

  it('handles name that IS the phrase', () => {
    expect(shortenOperatorName('Dive Center')).toBe('DC')
  })

  it('only shortens first matching phrase', () => {
    // Unlikely case but tests first-match-only behavior
    expect(shortenOperatorName('Dive Center Dive Resort')).toBe('DC Dive Resort')
  })
})
