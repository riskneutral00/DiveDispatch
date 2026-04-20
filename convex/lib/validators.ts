import { ConvexError, v } from 'convex/values'
import { RESOURCE_OWNER_TYPES, type ResourceOwnerType } from '../shared/resourceOwnerTypes'
import { addressStructuredValidator } from '../shared/addressValidator'
import { ErrorCode } from './errorCodes'

export const stakeholderTypeValidator = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

export type StakeholderRole = typeof stakeholderTypeValidator['type']

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
