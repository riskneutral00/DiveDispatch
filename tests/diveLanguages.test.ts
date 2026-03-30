import { describe, it, expect } from 'vitest'
import {
  languageToCode,
  localeToCountryCode,
  resolveLanguages,
} from '../src/lib/constants/dive-languages'

describe('localeToCountryCode', () => {
  it('extracts country code from locale', () => {
    expect(localeToCountryCode('en-GB')).toBe('GB')
  })

  it('extracts from zh-CN', () => {
    expect(localeToCountryCode('zh-CN')).toBe('CN')
  })

  it('returns uppercase for bare code', () => {
    expect(localeToCountryCode('gb')).toBe('GB')
  })

  it('handles multi-part locale (fil-PH)', () => {
    expect(localeToCountryCode('fil-PH')).toBe('PH')
  })
})

describe('languageToCode', () => {
  it('passes through valid ISO locale codes', () => {
    expect(languageToCode('en-GB')).toBe('en-GB')
    expect(languageToCode('zh-CN')).toBe('zh-CN')
  })

  it('converts ISO-639 bare codes to locale', () => {
    expect(languageToCode('en')).toBe('en-GB')
    expect(languageToCode('th')).toBe('th-TH')
    expect(languageToCode('zh')).toBe('zh-CN')
  })

  it('converts country codes to locale', () => {
    expect(languageToCode('GB')).toBe('en-GB')
    expect(languageToCode('TH')).toBe('th-TH')
  })

  it('converts labels to locale codes (case-insensitive)', () => {
    expect(languageToCode('English')).toBe('en-GB')
    expect(languageToCode('english')).toBe('en-GB')
    expect(languageToCode('Thai')).toBe('th-TH')
  })

  it('returns empty string for empty input', () => {
    expect(languageToCode('')).toBe('')
  })

  it('returns empty string for unknown input', () => {
    expect(languageToCode('klingon')).toBe('')
  })

  it('handles case-insensitive locale code match', () => {
    expect(languageToCode('EN-GB')).toBe('en-GB')
  })
})

describe('resolveLanguages', () => {
  it('resolves ISO locale codes to Language objects', () => {
    const result = resolveLanguages(['en-GB', 'th-TH'])
    expect(result).toHaveLength(2)
    expect(result[0].code).toBe('en-GB')
    expect(result[0].label).toBe('English')
    expect(result[1].code).toBe('th-TH')
    expect(result[1].label).toBe('Thai')
  })

  it('resolves bare language codes', () => {
    const result = resolveLanguages(['en', 'th'])
    expect(result).toHaveLength(2)
    expect(result[0].code).toBe('en-GB')
  })

  it('uses Chinese script labels for zh-CN and zh-TW', () => {
    const result = resolveLanguages(['zh-CN', 'zh-TW'])
    expect(result[0].label).toBe('简体')
    expect(result[1].label).toBe('繁體')
  })

  it('skips unknown codes', () => {
    const result = resolveLanguages(['en-GB', 'klingon'])
    expect(result).toHaveLength(1)
  })

  it('handles empty array', () => {
    expect(resolveLanguages([])).toEqual([])
  })
})
