import { describe, it, expect } from 'vitest'
import { languageFlagText } from '../src/components/common/language-flags'
import { languageToCode, resolveLanguages, PROFILE_LANGUAGE_OPTIONS, localeToCountryCode } from '../src/lib/constants/dive-languages'

describe('languageFlagText', () => {
  it('returns empty string for empty array', () => {
    expect(languageFlagText([])).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(languageFlagText(undefined)).toBe('')
  })

  it('returns all flags when array has 4 or fewer', () => {
    const result = languageFlagText(['en-GB', 'th-TH'])
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
  })

  it('caps at 4 flags by default', () => {
    const result = languageFlagText(['en-GB', 'th-TH', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE'])
    // Should contain first 4 flags
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
    expect(result).toContain('\u{1F1EF}\u{1F1F5}')
    expect(result).toContain('\u{1F1F0}\u{1F1F7}')
    // Should NOT contain 5th and 6th
    expect(result).not.toContain('\u{1F1EB}\u{1F1F7}')
    expect(result).not.toContain('\u{1F1E9}\u{1F1EA}')
  })

  it('respects custom max parameter', () => {
    const result = languageFlagText(['en-GB', 'th-TH', 'ja-JP'], 2)
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
    expect(result).not.toContain('\u{1F1EF}\u{1F1F5}')
  })

  it('prefixes with spaces for dropdown alignment', () => {
    const result = languageFlagText(['en-GB'])
    expect(result.startsWith('  ')).toBe(true)
  })

  it('resolves language names to flags (not just locale codes)', () => {
    const result = languageFlagText(['English', 'Thai'])
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
  })

  it('filters out unrecognized language strings', () => {
    const result = languageFlagText(['English', 'Klingon', 'Thai'])
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
    expect(result).not.toContain('Klingon')
  })

  it('resolves ISO-639 codes to flag emojis', () => {
    const result = languageFlagText(['en', 'zh'])
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1E8}\u{1F1F3}')
  })

  it('resolves old country codes via backward compat', () => {
    const result = languageFlagText(['GB', 'TH'])
    expect(result).toContain('\u{1F1EC}\u{1F1E7}')
    expect(result).toContain('\u{1F1F9}\u{1F1ED}')
  })
})

describe('languageToCode', () => {
  it('converts language name to ISO locale code', () => {
    expect(languageToCode('English')).toBe('en-GB')
    expect(languageToCode('Thai')).toBe('th-TH')
    expect(languageToCode('French')).toBe('fr-FR')
    expect(languageToCode('Japanese')).toBe('ja-JP')
  })

  it('is case-insensitive', () => {
    expect(languageToCode('english')).toBe('en-GB')
    expect(languageToCode('THAI')).toBe('th-TH')
  })

  it('passes through valid ISO locale codes', () => {
    expect(languageToCode('en-GB')).toBe('en-GB')
    expect(languageToCode('th-TH')).toBe('th-TH')
  })

  it('returns empty string for unknown input', () => {
    expect(languageToCode('Klingon')).toBe('')
    expect(languageToCode('')).toBe('')
  })

  it('resolves ISO-639 codes to ISO locale codes', () => {
    expect(languageToCode('en')).toBe('en-GB')
    expect(languageToCode('zh')).toBe('zh-CN')
    expect(languageToCode('ja')).toBe('ja-JP')
    expect(languageToCode('ko')).toBe('ko-KR')
    expect(languageToCode('pt')).toBe('pt-BR')
    expect(languageToCode('ar')).toBe('ar-SA')
    expect(languageToCode('he')).toBe('he-IL')
    expect(languageToCode('sv')).toBe('sv-SE')
  })

  it('resolves locale codes like zh-CN to ISO locale codes', () => {
    expect(languageToCode('zh-CN')).toBe('zh-CN')
    expect(languageToCode('zh-TW')).toBe('zh-TW')
    expect(languageToCode('en-US')).toBe('en-GB')
    expect(languageToCode('fr-CA')).toBe('fr-FR')
    expect(languageToCode('pt-BR')).toBe('pt-BR')
  })

  it('resolves old country codes via backward compat', () => {
    expect(languageToCode('GB')).toBe('en-GB')
    expect(languageToCode('TH')).toBe('th-TH')
    expect(languageToCode('FR')).toBe('fr-FR')
    expect(languageToCode('DE')).toBe('de-DE')
    expect(languageToCode('CN')).toBe('zh-CN')
    expect(languageToCode('TW')).toBe('zh-TW')
    expect(languageToCode('JP')).toBe('ja-JP')
    expect(languageToCode('KR')).toBe('ko-KR')
  })

  it('resolves ISO-639 codes that coincidentally match country codes', () => {
    expect(languageToCode('th')).toBe('th-TH')
    expect(languageToCode('fr')).toBe('fr-FR')
    expect(languageToCode('de')).toBe('de-DE')
    expect(languageToCode('ru')).toBe('ru-RU')
    expect(languageToCode('it')).toBe('it-IT')
    expect(languageToCode('es')).toBe('es-ES')
    expect(languageToCode('nl')).toBe('nl-NL')
    expect(languageToCode('pl')).toBe('pl-PL')
  })
})

describe('localeToCountryCode', () => {
  it('extracts country code from ISO locale', () => {
    expect(localeToCountryCode('en-GB')).toBe('GB')
    expect(localeToCountryCode('zh-CN')).toBe('CN')
    expect(localeToCountryCode('zh-TW')).toBe('TW')
    expect(localeToCountryCode('th-TH')).toBe('TH')
    expect(localeToCountryCode('ja-JP')).toBe('JP')
  })

  it('passes through bare country codes unchanged', () => {
    expect(localeToCountryCode('GB')).toBe('GB')
    expect(localeToCountryCode('CN')).toBe('CN')
  })
})

describe('PROFILE_LANGUAGE_OPTIONS round-trip', () => {
  for (const { code, label } of PROFILE_LANGUAGE_OPTIONS) {
    it(`${label} (${code}) resolves via languageToCode`, () => {
      expect(languageToCode(code)).toBe(code)
    })
  }
})

describe('resolveLanguages', () => {
  it('resolves ISO locale codes to Language objects', () => {
    expect(resolveLanguages(['zh-CN', 'th-TH'])).toEqual([
      { code: 'zh-CN', label: '\u7B80\u4F53' },
      { code: 'th-TH', label: 'Thai' },
    ])
  })

  it('resolves simplified Chinese (zh-CN) with native script label', () => {
    expect(resolveLanguages(['zh-CN'])).toEqual([
      { code: 'zh-CN', label: '\u7B80\u4F53' },
    ])
  })

  it('resolves traditional Chinese (zh-TW) with native script label', () => {
    expect(resolveLanguages(['zh-TW'])).toEqual([
      { code: 'zh-TW', label: '\u7E41\u9AD4' },
    ])
  })

  it('resolves locale codes', () => {
    expect(resolveLanguages(['en-US'])).toEqual([
      { code: 'en-GB', label: 'English' },
    ])
  })

  it('resolves ISO-639 codes', () => {
    expect(resolveLanguages(['zh', 'fr'])).toEqual([
      { code: 'zh-CN', label: '\u7B80\u4F53' },
      { code: 'fr-FR', label: 'French' },
    ])
  })

  it('resolves old country codes via backward compat', () => {
    expect(resolveLanguages(['CN', 'TH'])).toEqual([
      { code: 'zh-CN', label: '\u7B80\u4F53' },
      { code: 'th-TH', label: 'Thai' },
    ])
  })

  it('filters out unrecognized codes', () => {
    expect(resolveLanguages(['zh-CN', 'XX', 'th-TH'])).toEqual([
      { code: 'zh-CN', label: '\u7B80\u4F53' },
      { code: 'th-TH', label: 'Thai' },
    ])
  })

  it('handles empty array', () => {
    expect(resolveLanguages([])).toEqual([])
  })
})
