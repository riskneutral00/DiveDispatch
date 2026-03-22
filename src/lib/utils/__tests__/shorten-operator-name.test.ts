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

  it('replaces "Dive Resort" with "DR"', () => {
    expect(shortenOperatorName('Deep Dive Resort')).toBe('Deep DR')
  })

  it('replaces "Dive Hostel" with "DH"', () => {
    expect(shortenOperatorName('Koh Tao Dive Hostel')).toBe('Koh Tao DH')
  })

  it('replaces "Diving Center" with "DC"', () => {
    expect(shortenOperatorName('Thai Diving Center')).toBe('Thai DC')
  })

  it('returns name unchanged when no match', () => {
    expect(shortenOperatorName('Hug Ocean')).toBe('Hug Ocean')
  })

  it('returns short agent name unchanged', () => {
    expect(shortenOperatorName('Amanda')).toBe('Amanda')
  })
})
