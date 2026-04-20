import { ConvexError } from 'convex/values'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import {
  ISO_COUNTRY_CODES,
  SUPPORTED_LOCALE_CODES,
  E164_REGEX,
  normalizeChineseScript,
} from '../shared/i18nConstants'
import { ErrorCode } from './errorCodes'

type SupportedLocale = 'en' | 'zh-CN' | 'zh-TW' | 'th' | 'fr' | 'ko'

export function assertCountryCode(code: string, field = 'country'): void {
  if (!/^[A-Z]{2}$/.test(code) || !ISO_COUNTRY_CODES.has(code)) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `invalid_country_code:${field}:${code}`,
    })
  }
}

export function assertPhoneE164(phone: string, field = 'phone'): void {
  if (!E164_REGEX.test(phone)) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `invalid_phone_shape:${field}`,
    })
  }
  const parsed = parsePhoneNumberFromString(phone)
  if (!parsed?.isValid()) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `invalid_phone_e164:${field}`,
    })
  }
}

export function assertSupportedLocale(locale: string, field = 'appLanguage'): void {
  if (!SUPPORTED_LOCALE_CODES.has(locale)) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `invalid_locale:${field}:${locale}`,
    })
  }
}

export function assertLanguageCodes(codes: readonly string[], field: string): void {
  for (const code of codes) {
    if (typeof code !== 'string' || code.length === 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_language_code:${field}:empty`,
      })
    }
    if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(code)) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_language_code:${field}:${code}`,
      })
    }
  }
}

export function normalizeAppLanguage(code: string): SupportedLocale {
  if (typeof code !== 'string' || code.length === 0) return 'en'
  const scripted = normalizeChineseScript(code)
  if (SUPPORTED_LOCALE_CODES.has(scripted)) return scripted as SupportedLocale
  const base = scripted.split('-')[0]
  if (SUPPORTED_LOCALE_CODES.has(base)) return base as SupportedLocale
  return 'en'
}

export function normalizeAppLanguageOrThrow(code: string, field = 'appLanguage'): SupportedLocale {
  if (typeof code !== 'string' || code.length === 0) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `invalid_locale:${field}:empty`,
    })
  }
  const scripted = normalizeChineseScript(code)
  if (SUPPORTED_LOCALE_CODES.has(scripted)) return scripted as SupportedLocale
  const base = scripted.split('-')[0]
  if (SUPPORTED_LOCALE_CODES.has(base)) return base as SupportedLocale
  throw new ConvexError({
    code: ErrorCode.VALIDATION,
    reason: `invalid_locale:${field}:${code}`,
  })
}
