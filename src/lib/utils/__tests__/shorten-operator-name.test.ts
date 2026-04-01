import { describe, it, expect } from 'vitest'
import { shortenOperatorName } from '../shorten-operator-name'

describe('shortenOperatorName', () => {
  it('replaces "Dive Center" with "DC"', () => {
    expect(shortenOperatorName('Phuket Dive Center')).toBe('Phuket DC')
  })

  it('replaces "Dive Center" when it is the entire name', () => {
    expect(shortenOperatorName('Dive Center')).toBe('DC')
  })

  it('replaces "Nicole Dive Center"', () => {
    expect(shortenOperatorName('Nicole Dive Center')).toBe('Nicole DC')
  })

  it('shortens "Dive Center" to "DC" (alternate wording)', () => {
    expect(shortenOperatorName('Blue Dive Center')).toBe('Blue DC')
  })

  it('replaces "Dive Resort" with "DR"', () => {
    expect(shortenOperatorName('Deep Dive Resort')).toBe('Deep DR')
  })

  it('shortens "Dive Resort" to "DR"', () => {
    expect(shortenOperatorName('Coral Dive Resort')).toBe('Coral DR')
  })

  it('replaces "Dive Hostel" with "DH"', () => {
    expect(shortenOperatorName('Koh Tao Dive Hostel')).toBe('Koh Tao DH')
  })

  it('shortens "Dive Hostel" to "DH"', () => {
    expect(shortenOperatorName('Ocean Dive Hostel')).toBe('Ocean DH')
  })

  it('replaces "Diving Center" with "DC"', () => {
    expect(shortenOperatorName('Thai Diving Center')).toBe('Thai DC')
  })

  it('shortens "Diving Center" to "DC"', () => {
    expect(shortenOperatorName('Scuba Diving Center')).toBe('Scuba DC')
  })

  it('returns name unchanged when no match', () => {
    expect(shortenOperatorName('Hug Ocean')).toBe('Hug Ocean')
  })

  it('returns unchanged name when no known phrase matches', () => {
    expect(shortenOperatorName('Ocean Adventures')).toBe('Ocean Adventures')
  })

  it('returns short agent name unchanged', () => {
    expect(shortenOperatorName('Amanda')).toBe('Amanda')
  })

  it('only replaces the first matching phrase', () => {
    expect(shortenOperatorName('Dive Center Dive Resort')).toBe('DC Dive Resort')
  })

  it('returns empty string for empty input', () => {
    expect(shortenOperatorName('')).toBe('')
  })
})
