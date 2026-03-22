import { describe, it, expect } from 'vitest'
import { languageFlagText } from '../src/components/common/language-flags'
import { languageToCode } from '../src/lib/constants/dive-languages'

describe('languageFlagText', () => {
  it('returns empty string for empty array', () => {
    expect(languageFlagText([])).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(languageFlagText(undefined)).toBe('')
  })

  it('returns all flags when array has 4 or fewer', () => {
    const result = languageFlagText(['GB', 'TH'])
    expect(result).toContain('🇬🇧')
    expect(result).toContain('🇹🇭')
  })

  it('caps at 4 flags by default', () => {
    const result = languageFlagText(['GB', 'TH', 'JP', 'KR', 'FR', 'DE'])
    // Should contain first 4 flags
    expect(result).toContain('🇬🇧')
    expect(result).toContain('🇹🇭')
    expect(result).toContain('🇯🇵')
    expect(result).toContain('🇰🇷')
    // Should NOT contain 5th and 6th
    expect(result).not.toContain('🇫🇷')
    expect(result).not.toContain('🇩🇪')
  })

  it('respects custom max parameter', () => {
    const result = languageFlagText(['GB', 'TH', 'JP'], 2)
    expect(result).toContain('🇬🇧')
    expect(result).toContain('🇹🇭')
    expect(result).not.toContain('🇯🇵')
  })

  it('prefixes with spaces for dropdown alignment', () => {
    const result = languageFlagText(['GB'])
    expect(result.startsWith('  ')).toBe(true)
  })

  it('resolves language names to flags (not just country codes)', () => {
    const result = languageFlagText(['English', 'Thai'])
    expect(result).toContain('🇬🇧')
    expect(result).toContain('🇹🇭')
  })

  it('filters out unrecognized language strings', () => {
    const result = languageFlagText(['English', 'Klingon', 'Thai'])
    expect(result).toContain('🇬🇧')
    expect(result).toContain('🇹🇭')
    expect(result).not.toContain('Klingon')
  })
})

describe('languageToCode', () => {
  it('converts language name to country code', () => {
    expect(languageToCode('English')).toBe('GB')
    expect(languageToCode('Thai')).toBe('TH')
    expect(languageToCode('French')).toBe('FR')
    expect(languageToCode('Japanese')).toBe('JP')
  })

  it('is case-insensitive', () => {
    expect(languageToCode('english')).toBe('GB')
    expect(languageToCode('THAI')).toBe('TH')
  })

  it('passes through valid 2-letter country codes', () => {
    expect(languageToCode('GB')).toBe('GB')
    expect(languageToCode('TH')).toBe('TH')
  })

  it('returns empty string for unknown input', () => {
    expect(languageToCode('Klingon')).toBe('')
    expect(languageToCode('')).toBe('')
  })
})
