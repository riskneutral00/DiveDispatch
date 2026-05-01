import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  assertCountryCode,
  assertPhoneE164,
  assertLanguageCodes,
  normalizeEmail,
  normalizeAppLanguage,
} from '../convex/lib/validators'

function reasonOf(err: unknown): string {
  if (!(err instanceof ConvexError)) return String(err)
  const d = err.data as { code?: string; reason?: string }
  return `${d.code ?? ''}:${d.reason ?? ''}`
}

describe('assertCountryCode', () => {
  it('accepts valid ISO-2', () => {
    expect(() => assertCountryCode('TH')).not.toThrow()
    expect(() => assertCountryCode('US')).not.toThrow()
  })

  it('rejects lowercase', () => {
    try {
      assertCountryCode('th')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_country_code/)
    }
  })

  it('rejects non-ISO strings', () => {
    expect(() => assertCountryCode('XX')).toThrow(ConvexError)
    expect(() => assertCountryCode('USA')).toThrow(ConvexError)
  })
})

describe('assertPhoneE164', () => {
  it('accepts a real Thai mobile', () => {
    expect(() => assertPhoneE164('+66812345678')).not.toThrow()
  })

  it('rejects missing + prefix', () => {
    try {
      assertPhoneE164('66812345678')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_phone_shape/)
    }
  })

  it('rejects a phone with spaces (non-E.164 shape)', () => {
    try {
      assertPhoneE164('+66 81 234 5678')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_phone_shape/)
    }
  })

  it('rejects a syntactically-E.164 string that is not a real phone', () => {
    try {
      assertPhoneE164('+1234567890')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_phone_e164/)
    }
  })

  it('rejects garbage', () => {
    try {
      assertPhoneE164('not-a-phone')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_phone_shape/)
    }
  })

  it('reports the field name in the reason', () => {
    try {
      assertPhoneE164('not-a-phone', 'emergencyContactPhone')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/invalid_phone_shape:emergencyContactPhone/)
    }
  })
})

describe('assertLanguageCodes', () => {
  it('accepts a small array of well-shaped codes', () => {
    expect(() => assertLanguageCodes(['en', 'zh-TW', 'th'], 'languages')).not.toThrow()
  })

  it('rejects an empty string in the array', () => {
    try {
      assertLanguageCodes(['en', ''], 'languages')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_language_code:languages:empty/)
    }
  })

  it('rejects a bogus shape', () => {
    try {
      assertLanguageCodes(['EN', '12', 'fra_FR'], 'languages')
      throw new Error('should have thrown')
    } catch (e) {
      expect(reasonOf(e)).toMatch(/VALIDATION:invalid_language_code:languages:EN/)
    }
  })

  it('allows long form with script + region', () => {
    expect(() => assertLanguageCodes(['zh-Hant-TW'], 'f')).not.toThrow()
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases input', () => {
    expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
  })

  it('returns empty string for missing input', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
  })
})

describe('normalizeAppLanguage (canonical)', () => {
  it('collapses Chinese script tags', () => {
    expect(normalizeAppLanguage('zh-Hans-CN')).toBe('zh-CN')
    expect(normalizeAppLanguage('zh-Hant-TW')).toBe('zh-TW')
  })

  it('collapses non-Chinese dialect tags to supported base locales', () => {
    expect(normalizeAppLanguage('th-TH')).toBe('th')
    expect(normalizeAppLanguage('en-GB')).toBe('en')
    expect(normalizeAppLanguage('ko-KR')).toBe('ko')
  })

  it('falls back to en for unsupported locales', () => {
    expect(normalizeAppLanguage('es')).toBe('en')
    expect(normalizeAppLanguage('vi')).toBe('en')
  })

  it('returns "en" on empty input', () => {
    expect(normalizeAppLanguage('')).toBe('en')
  })

  it('throws on malformed shape', () => {
    expect(() => normalizeAppLanguage('XX-yy-zz-too-long')).toThrow(ConvexError)
  })
})
