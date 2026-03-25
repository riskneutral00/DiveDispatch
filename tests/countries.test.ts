import { describe, it, expect } from 'vitest'
import { getFlagEmoji, COUNTRIES } from '../src/lib/constants/countries'

describe('getFlagEmoji', () => {
  it('converts US to flag emoji', () => {
    expect(getFlagEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}')
  })

  it('converts TH to flag emoji', () => {
    expect(getFlagEmoji('TH')).toBe('\u{1F1F9}\u{1F1ED}')
  })

  it('handles lowercase by converting to uppercase', () => {
    expect(getFlagEmoji('gb')).toBe('\u{1F1EC}\u{1F1E7}')
  })

  it('returns globe for empty string', () => {
    expect(getFlagEmoji('')).toBe('\u{1F310}')
  })

  it('returns globe for single character', () => {
    expect(getFlagEmoji('A')).toBe('\u{1F310}')
  })

  it('returns globe for three characters', () => {
    expect(getFlagEmoji('USA')).toBe('\u{1F310}')
  })
})

describe('COUNTRIES', () => {
  it('is a non-empty array', () => {
    expect(COUNTRIES.length).toBeGreaterThan(0)
  })

  it('each entry has code and label', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.code.length).toBe(2)
    }
  })

  it('contains Thailand', () => {
    expect(COUNTRIES.find((c) => c.code === 'TH')?.label).toBe('Thailand')
  })
})
