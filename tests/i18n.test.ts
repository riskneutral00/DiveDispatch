import { describe, it, expect } from 'vitest'
import {
  isValidCountryCode,
  isValidPhoneE164,
  isValidLocale,
  isValidLanguageCode,
  normalizePhone,
  normalizePhoneFromSelectedCountry,
  normalizeChineseScript,
  detectDefaultCountryFromLocale,
} from '../src/lib/constants/i18n'
import {
  isValidIsoCountryCode,
  isValidSupportedLocale,
  isE164Shape,
  normalizeChineseScript as convexNormalizeChineseScript,
} from '../convex/shared/i18nConstants'
import {
  assertCountryCode,
  assertPhoneE164,
  assertLanguageCodes,
  normalizeEmail,
  normalizeAppLanguage,
} from '../convex/lib/validators'
import { normalizeAppLanguage as feNormalizeAppLanguage } from '../src/lib/constants/i18n'
import {
  e164Schema,
  countryCodeSchema,
  localeSchema,
  languageCodeSchema,
  addressSchema,
} from '../src/lib/schemas/i18n'

describe('src i18n — country code', () => {
  it.each([['TH'], ['US'], ['GB'], ['JP'], ['CN'], ['TW']])('accepts %s', (code) => {
    expect(isValidCountryCode(code)).toBe(true)
  })

  it.each([
    ['Thailand'],
    ['th'],
    ['TH '],
    [''],
    ['T'],
    ['ZZ'],
    ['thailand'],
    [null],
    [undefined],
    [123],
  ])('rejects %p', (code) => {
    expect(isValidCountryCode(code as unknown)).toBe(false)
  })
})

describe('src i18n — phone E.164', () => {
  it.each([
    ['+6676330345'],
    ['+14155551234'],
    ['+442071838750'],
    ['+81312345678'],
  ])('accepts %s', (phone) => {
    expect(isValidPhoneE164(phone)).toBe(true)
  })

  it.each([
    ['6676330345'],
    ['+66-76-330-345'],
    ['+1'],
    [''],
    ['not a phone'],
    [null],
  ])('rejects %p', (phone) => {
    expect(isValidPhoneE164(phone as unknown)).toBe(false)
  })

  it('normalizePhone returns E.164 for valid input', () => {
    expect(normalizePhone('+66 76 330 345')).toBe('+6676330345')
    expect(normalizePhone('+1-415-555-1234')).toBe('+14155551234')
  })

  it('normalizePhone returns null for invalid input', () => {
    expect(normalizePhone('not a phone')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })

  it('normalizePhone accepts local format with defaultCountry', () => {
    expect(normalizePhone('0812345678', 'TH')).toBe('+66812345678')
  })

  it('normalizePhoneFromSelectedCountry strips duplicated calling code', () => {
    expect(normalizePhoneFromSelectedCountry('66812345678', 'TH')).toBe('+66812345678')
    expect(normalizePhoneFromSelectedCountry('14155551234', 'US')).toBe('+14155551234')
  })
})

describe('src i18n — locale', () => {
  it.each([['en'], ['zh-CN'], ['zh-TW'], ['th'], ['fr'], ['ko']])(
    'accepts SupportedLocale %s',
    (locale) => {
      expect(isValidLocale(locale)).toBe(true)
    },
  )

  it.each([['en-GB'], ['th-TH'], ['ja'], ['de'], [''], ['klingon']])(
    'rejects %p',
    (locale) => {
      expect(isValidLocale(locale)).toBe(false)
    },
  )
})

describe('src i18n — language code (BCP 47 full set)', () => {
  it.each([['en-GB'], ['th-TH'], ['zh-CN'], ['zh-TW'], ['ja-JP'], ['ko-KR']])(
    'accepts known %s',
    (code) => {
      expect(isValidLanguageCode(code)).toBe(true)
    },
  )

  it.each([['klingon'], ['en'], [''], ['zz-ZZ']])('rejects %p', (code) => {
    expect(isValidLanguageCode(code)).toBe(false)
  })
})

describe('src i18n — Chinese script normalization', () => {
  it('maps zh-Hans → zh-CN', () => {
    expect(normalizeChineseScript('zh-Hans')).toBe('zh-CN')
    expect(normalizeChineseScript('zh-Hans-CN')).toBe('zh-CN')
  })

  it('maps zh-Hant → zh-TW', () => {
    expect(normalizeChineseScript('zh-Hant')).toBe('zh-TW')
    expect(normalizeChineseScript('zh-Hant-TW')).toBe('zh-TW')
    expect(normalizeChineseScript('zh-Hant-HK')).toBe('zh-TW')
  })

  it('leaves non-zh codes unchanged', () => {
    expect(normalizeChineseScript('en')).toBe('en')
    expect(normalizeChineseScript('zh-CN')).toBe('zh-CN')
    expect(normalizeChineseScript('ja-JP')).toBe('ja-JP')
  })
})

describe('src i18n — detectDefaultCountryFromLocale', () => {
  it('extracts region from full BCP 47', () => {
    expect(detectDefaultCountryFromLocale('en-GB')).toBe('GB')
    expect(detectDefaultCountryFromLocale('ja-JP')).toBe('JP')
    expect(detectDefaultCountryFromLocale('zh-TW')).toBe('TW')
  })

  it('maps single-tag locale to primary country', () => {
    expect(detectDefaultCountryFromLocale('en')).toBe('US')
    expect(detectDefaultCountryFromLocale('ja')).toBe('JP')
    expect(detectDefaultCountryFromLocale('th')).toBe('TH')
    expect(detectDefaultCountryFromLocale('ko')).toBe('KR')
  })

  it('defaults to TH when locale is missing or unknown', () => {
    expect(detectDefaultCountryFromLocale(null)).toBe('TH')
    expect(detectDefaultCountryFromLocale(undefined)).toBe('TH')
    expect(detectDefaultCountryFromLocale('klingon')).toBe('TH')
  })
})

describe('convex/shared/i18nConstants — mirrors validate equivalently', () => {
  it('ISO country codes agree src ↔ convex', () => {
    const samples = ['TH', 'US', 'GB', 'ZZ', 'thailand', '', 'T']
    for (const s of samples) {
      expect(isValidIsoCountryCode(s)).toBe(isValidCountryCode(s))
    }
  })

  it('supported locales agree src ↔ convex', () => {
    const samples = ['en', 'zh-CN', 'en-GB', 'th', 'klingon', '']
    for (const s of samples) {
      expect(isValidSupportedLocale(s)).toBe(isValidLocale(s))
    }
  })

  it('convex E.164 regex shape-check matches format', () => {
    expect(isE164Shape('+6676330345')).toBe(true)
    expect(isE164Shape('+14155551234')).toBe(true)
    expect(isE164Shape('6676330345')).toBe(false)
    expect(isE164Shape('+66-76-330-345')).toBe(false)
    expect(isE164Shape('')).toBe(false)
  })

  it('convex Chinese script normalization matches src', () => {
    const samples = ['zh-Hans', 'zh-Hans-CN', 'zh-Hant', 'zh-Hant-TW', 'en', 'zh-CN']
    for (const s of samples) {
      expect(convexNormalizeChineseScript(s)).toBe(normalizeChineseScript(s))
    }
  })
})

describe('convex/lib/i18nValidators — throw behavior', () => {
  it('assertCountryCode accepts valid ISO', () => {
    expect(() => assertCountryCode('TH')).not.toThrow()
    expect(() => assertCountryCode('GB')).not.toThrow()
  })

  it('assertCountryCode throws on invalid', () => {
    expect(() => assertCountryCode('Thailand')).toThrow()
    expect(() => assertCountryCode('th')).toThrow()
    expect(() => assertCountryCode('ZZ')).toThrow()
    expect(() => assertCountryCode('')).toThrow()
  })

  it('assertPhoneE164 accepts valid', () => {
    expect(() => assertPhoneE164('+6676330345')).not.toThrow()
    expect(() => assertPhoneE164('+14155551234')).not.toThrow()
  })

  it('assertPhoneE164 throws on invalid shape', () => {
    expect(() => assertPhoneE164('+66-76-330-345')).toThrow()
    expect(() => assertPhoneE164('6676330345')).toThrow()
    expect(() => assertPhoneE164('+1')).toThrow()
    expect(() => assertPhoneE164('')).toThrow()
  })

})

describe('src Zod schemas — i18n', () => {
  it('e164Schema accepts valid E.164', () => {
    expect(e164Schema.safeParse('+6676330345').success).toBe(true)
  })

  it('e164Schema rejects non-E.164', () => {
    expect(e164Schema.safeParse('+66-76-330-345').success).toBe(false)
    expect(e164Schema.safeParse('').success).toBe(false)
  })

  it('countryCodeSchema uppercases + validates', () => {
    const parsed = countryCodeSchema.safeParse('th')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('TH')
  })

  it('countryCodeSchema rejects non-ISO', () => {
    expect(countryCodeSchema.safeParse('Thailand').success).toBe(false)
    expect(countryCodeSchema.safeParse('ZZ').success).toBe(false)
  })

  it('localeSchema accepts SUPPORTED_LOCALES entries only', () => {
    expect(localeSchema.safeParse('en').success).toBe(true)
    expect(localeSchema.safeParse('zh-CN').success).toBe(true)
    expect(localeSchema.safeParse('en-GB').success).toBe(false)
  })

  it('languageCodeSchema accepts ALL_LANGUAGES codes', () => {
    expect(languageCodeSchema.safeParse('en-GB').success).toBe(true)
    expect(languageCodeSchema.safeParse('zh-CN').success).toBe(true)
    expect(languageCodeSchema.safeParse('ja-JP').success).toBe(true)
    expect(languageCodeSchema.safeParse('klingon').success).toBe(false)
  })

  it('addressSchema requires city + country; rest optional', () => {
    expect(
      addressSchema.safeParse({ city: 'Phuket', country: 'TH' }).success,
    ).toBe(true)

    expect(
      addressSchema.safeParse({
        street: '44 Thanon Kata',
        city: 'Phuket',
        state: 'Phuket',
        country: 'TH',
        postalCode: '83100',
      }).success,
    ).toBe(true)

    expect(addressSchema.safeParse({ country: 'TH' }).success).toBe(false)
    expect(addressSchema.safeParse({ city: 'Phuket' }).success).toBe(false)
    expect(
      addressSchema.safeParse({ city: 'Phuket', country: 'ZZ' }).success,
    ).toBe(false)
  })
})

describe('convex normalizeAppLanguage — canonical supported locale normalization', () => {
  it.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    ['zh-CN', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['th-TH', 'th'],
    ['fr-FR', 'fr'],
    ['ko-KR', 'ko'],
    ['de', 'en'],
    ['ja', 'en'],
    ['es', 'en'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalizeAppLanguage(input)).toBe(expected)
  })

  it('returns "en" on empty input', () => {
    expect(normalizeAppLanguage('')).toBe('en')
  })

  it('mirrors FE behavior', () => {
    expect(feNormalizeAppLanguage('zh-Hans-HK')).toBe('zh-CN')
    expect(feNormalizeAppLanguage('en-GB')).toBe('en')
    expect(normalizeAppLanguage('en-GB')).toBe(feNormalizeAppLanguage('en-GB'))
    expect(feNormalizeAppLanguage(null)).toBe('en')
    expect(feNormalizeAppLanguage(undefined)).toBe('en')
  })
})

describe('convex normalizeEmail', () => {
  it('lowercases and trims identity email values', () => {
    expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com')
  })
})

describe('convex assertLanguageCodes — shape guard', () => {
  it('accepts well-formed codes', () => {
    expect(() => assertLanguageCodes(['en', 'zh-CN', 'th'], 'langs')).not.toThrow()
    expect(() => assertLanguageCodes([], 'langs')).not.toThrow()
  })

  it('rejects empty string', () => {
    expect(() => assertLanguageCodes(['en', ''], 'langs')).toThrow()
  })

  it('rejects malformed codes', () => {
    expect(() => assertLanguageCodes(['EN'], 'langs')).toThrow()
    expect(() => assertLanguageCodes(['english'], 'langs')).toThrow()
    expect(() => assertLanguageCodes(['zh_CN'], 'langs')).toThrow()
  })
})
