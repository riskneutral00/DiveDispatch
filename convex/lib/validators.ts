import { ConvexError, v } from 'convex/values'
import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { RESOURCE_OWNER_TYPES, type ResourceOwnerType } from '../shared/resourceOwnerTypes'
import { addressStructuredValidator } from '../shared/addressValidator'
import {
  ISO_COUNTRY_CODES,
  SUPPORTED_LOCALE_CODES,
  E164_REGEX,
  normalizeChineseScript,
} from '../shared/i18nConstants'
import { RANGE_BY_KIND, type VenueKind } from '../shared/venueTypes'
import { ErrorCode } from './errorCodes'

type SupportedLocale = 'en' | 'zh-CN' | 'zh-TW' | 'th' | 'fr' | 'ko'

export const stakeholderTypeValidator = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Compressor'),
  v.literal('Venue'),
)

export const personRoleValidator = v.union(
  v.literal('Instructor'),
  v.literal('Agent'),
)

export type StakeholderRole = typeof stakeholderTypeValidator['type']
export type PersonRoleLiteral = typeof personRoleValidator['type']

const RESOURCE_TYPES: ReadonlySet<string> = new Set(RESOURCE_OWNER_TYPES)

export function effectiveResourceType(roleType: string): ResourceOwnerType | null {
  return RESOURCE_TYPES.has(roleType) ? (roleType as ResourceOwnerType) : null
}

export const TIME_REGEX = /^\d{2}:\d{2}$/

export function assertValidTime(value: string, field: string): void {
  if (!TIME_REGEX.test(value)) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `${field} must be HH:MM format` })
  }
}

export function normalizeTime(t: string): string {
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

export const gearTypeValidator = v.union(
  v.literal('wetsuit'),
  v.literal('bcd'),
  v.literal('fins'),
  v.literal('mask'),
  v.literal('regulator'),
)

export const finSizeSystemValidator = v.union(
  v.literal('eu'),
  v.literal('us'),
  v.literal('cm'),
  v.literal('letter'),
)

export const gearRentalValidator = v.union(v.literal('own'), v.literal('rent'))

export const rentalChecklistValidator = v.object({
  mask: gearRentalValidator,
  bcd: gearRentalValidator,
  wetsuit: gearRentalValidator,
  fins: gearRentalValidator,
  regulator: gearRentalValidator,
  maskPrescription: v.optional(v.string()),
})

export const BASE_PROFILE_CREATE_FIELDS = {
  address: addressStructuredValidator,
  placeId: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
  email: v.string(),
  phone: v.string(),
}

export const BASE_PROFILE_UPDATE_FIELDS = {
  address: v.optional(addressStructuredValidator),
  placeId: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
}

export const BUSINESS_NAME_CREATE_FIELD = { name: v.string() }
export const BUSINESS_NAME_UPDATE_FIELD = { name: v.optional(v.string()) }

export const ACCESS_CONTROL_FIELDS = {
  isAllowed: v.optional(v.array(v.string())),
  notAllowed: v.optional(v.array(v.string())),
}

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

export function assertVenueRange(
  kind: VenueKind,
  maxDepth?: number,
  maxCapacity?: number,
): void {
  const range = RANGE_BY_KIND[kind]
  if (maxDepth !== undefined) {
    if (typeof maxDepth !== 'number' || Number.isNaN(maxDepth) || maxDepth < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_depth:${kind}:${maxDepth}`,
      })
    }
    if (maxDepth > range.maxDepth) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_depth_exceeds_kind_cap:${kind}:${maxDepth}>${range.maxDepth}`,
      })
    }
  }
  if (maxCapacity !== undefined) {
    if (typeof maxCapacity !== 'number' || Number.isNaN(maxCapacity) || maxCapacity < 0) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `invalid_max_capacity:${kind}:${maxCapacity}`,
      })
    }
    if (maxCapacity > range.maxCapacity) {
      throw new ConvexError({
        code: ErrorCode.VALIDATION,
        reason: `max_capacity_exceeds_kind_cap:${kind}:${maxCapacity}>${range.maxCapacity}`,
      })
    }
  }
}

export function assertVenueKindConsistent(
  kind: VenueKind,
  confinedCapable: boolean | undefined,
): void {
  if (kind === 'pool' && confinedCapable === false) {
    throw new ConvexError({
      code: ErrorCode.VALIDATION,
      reason: `pool_must_be_confined_capable`,
    })
  }
}

export function assertZodSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  const field = issue.path.join('.')
  throw new ConvexError({ code: ErrorCode.VALIDATION, field, reason: issue.message })
}
