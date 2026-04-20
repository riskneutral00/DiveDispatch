import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { COUNTRIES } from './countries'
import { SUPPORTED_LOCALES, type SupportedLocale } from './locales'
import { ALL_LANGUAGES, type LanguageCode } from './dive-languages'

export const COUNTRY_CODES: ReadonlySet<string> = new Set(COUNTRIES.map((c) => c.code))
export const LANGUAGE_CODES: ReadonlySet<string> = new Set(
  ALL_LANGUAGES.map((l) => l.code),
)
export const LOCALE_CODES: ReadonlySet<string> = new Set(SUPPORTED_LOCALES)

export const E164_REGEX = /^\+[1-9]\d{1,14}$/

export function isValidCountryCode(code: unknown): code is string {
  if (typeof code !== 'string') return false
  return /^[A-Z]{2}$/.test(code) && COUNTRY_CODES.has(code)
}

export function isValidPhoneE164(phone: unknown): phone is string {
  if (typeof phone !== 'string' || phone.length === 0) return false
  if (!E164_REGEX.test(phone)) return false
  const parsed = parsePhoneNumberFromString(phone)
  return parsed?.isValid() ?? false
}

export function normalizePhone(
  input: string,
  defaultCountry?: CountryCode,
): string | null {
  if (!input) return null
  const parsed = parsePhoneNumberFromString(input, defaultCountry)
  return parsed?.isValid() ? parsed.format('E.164') : null
}

export function isValidLocale(code: unknown): code is SupportedLocale {
  if (typeof code !== 'string') return false
  return LOCALE_CODES.has(code)
}

export function isValidLanguageCode(code: unknown): code is LanguageCode {
  if (typeof code !== 'string') return false
  return LANGUAGE_CODES.has(code)
}

export function normalizeChineseScript(code: string): string {
  if (code.startsWith('zh-Hans')) return 'zh-CN'
  if (code.startsWith('zh-Hant')) return 'zh-TW'
  return code
}

export function normalizeAppLanguage(code: string | undefined | null): SupportedLocale {
  if (!code) return 'en'
  const scripted = normalizeChineseScript(code)
  if (LOCALE_CODES.has(scripted)) return scripted as SupportedLocale
  const base = scripted.split('-')[0]
  if (LOCALE_CODES.has(base)) return base as SupportedLocale
  return 'en'
}

const LOCALE_PRIMARY_COUNTRY: Record<string, CountryCode> = {
  en: 'US',
  zh: 'CN',
  th: 'TH',
  fr: 'FR',
  ko: 'KR',
  ja: 'JP',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  nl: 'NL',
  ru: 'RU',
  ar: 'SA',
  id: 'ID',
  vi: 'VN',
}

export function detectDefaultCountryFromLocale(
  locale: string | undefined | null,
): CountryCode {
  if (!locale) return 'TH'
  const regionMatch = locale.match(/-([A-Z]{2})$/i)
  if (regionMatch) {
    const code = regionMatch[1].toUpperCase()
    if (isValidCountryCode(code)) return code as CountryCode
  }
  const base = locale.toLowerCase().split('-')[0]
  return LOCALE_PRIMARY_COUNTRY[base] ?? 'TH'
}
