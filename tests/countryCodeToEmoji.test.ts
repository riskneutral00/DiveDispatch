import { describe, it, expect } from 'vitest'
import { countryCodeToEmoji } from '../src/components/common/flag-emoji'

describe('countryCodeToEmoji', () => {
  it('converts US to US flag emoji', () => {
    expect(countryCodeToEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}')
  })

  it('converts GB to GB flag emoji', () => {
    expect(countryCodeToEmoji('GB')).toBe('\u{1F1EC}\u{1F1E7}')
  })

  it('extracts region from ISO locale (en-GB)', () => {
    expect(countryCodeToEmoji('en-GB')).toBe('\u{1F1EC}\u{1F1E7}')
  })

  it('extracts region from zh-CN', () => {
    expect(countryCodeToEmoji('zh-CN')).toBe('\u{1F1E8}\u{1F1F3}')
  })

  it('handles lowercase input', () => {
    expect(countryCodeToEmoji('th')).toBe('\u{1F1F9}\u{1F1ED}')
  })

  it('handles locale with lowercase region', () => {
    expect(countryCodeToEmoji('ja-jp')).toBe('\u{1F1EF}\u{1F1F5}')
  })

  it('returns consistent results for same input', () => {
    expect(countryCodeToEmoji('TH')).toBe(countryCodeToEmoji('TH'))
  })
})
