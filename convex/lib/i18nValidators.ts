import { ConvexError } from 'convex/values'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import {
  ISO_COUNTRY_CODES,
  SUPPORTED_LOCALE_CODES,
  E164_REGEX,
} from '../shared/i18nConstants'
import { ErrorCode } from './errorCodes'

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
