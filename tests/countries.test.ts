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

  it('each entry has a 2-char code and non-empty label', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/)
      expect(c.label.length).toBeGreaterThan(0)
    }
  })

  it('contains Thailand', () => {
    expect(COUNTRIES.find((c) => c.code === 'TH')?.label).toBe('Thailand')
  })

  it('has no duplicate codes', () => {
    const codes = COUNTRIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('has no duplicate labels', () => {
    const labels = COUNTRIES.map((c) => c.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('contains United States', () => {
    expect(COUNTRIES.find((c) => c.code === 'US')?.label).toContain('United States')
  })

  it('has at least 200 countries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(200)
  })
})
