import { describe, it, expect } from 'vitest'
import { shortenOperatorName } from '../src/lib/utils/shorten-operator-name'

describe('shortenOperatorName', () => {
  it('shortens "Dive Center" to "DC"', () => {
    expect(shortenOperatorName('Blue Dive Center')).toBe('Blue DC')
  })

  it('shortens "Dive Resort" to "DR"', () => {
    expect(shortenOperatorName('Coral Dive Resort')).toBe('Coral DR')
  })

  it('shortens "Dive Hostel" to "DH"', () => {
    expect(shortenOperatorName('Ocean Dive Hostel')).toBe('Ocean DH')
  })

  it('shortens "Diving Center" to "DC"', () => {
    expect(shortenOperatorName('Scuba Diving Center')).toBe('Scuba DC')
  })

  it('returns unchanged name when no known phrase matches', () => {
    expect(shortenOperatorName('Ocean Adventures')).toBe('Ocean Adventures')
  })

  it('only replaces the first matching phrase', () => {
    expect(shortenOperatorName('Dive Center Dive Resort')).toBe('DC Dive Resort')
  })

  it('handles name that is exactly the phrase', () => {
    expect(shortenOperatorName('Dive Center')).toBe('DC')
  })

  it('returns empty string for empty input', () => {
    expect(shortenOperatorName('')).toBe('')
  })
})
