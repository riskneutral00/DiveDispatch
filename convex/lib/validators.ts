import { ConvexError, v } from 'convex/values'
import { RESOURCE_OWNER_TYPES, type ResourceOwnerType } from '../shared/resourceOwnerTypes'
import { ErrorCode } from './errorCodes'

/** Canonical stakeholder type validator — use this everywhere instead of redefining. */
export const stakeholderTypeValidator = v.union(
  v.literal('DiveCenter'),
  v.literal('Agent'),
  v.literal('Instructor'),
  v.literal('Boat'),
  v.literal('Equipment'),
  v.literal('Pool'),
  v.literal('Compressor'),
  v.literal('DiveMaster'),
  v.literal('Liveaboard'),
  v.literal('DiveResort'),
  v.literal('DiveHostel'),
  v.literal('DiveSite'),
)

/** TypeScript type derived from the validator. */
export type StakeholderRole = typeof stakeholderTypeValidator['type']

/**
 * DiveMaster shares the Instructor reservation path (resourceType: 'Instructor').
 * All other resource-owning roles map 1:1 to their resourceType.
 * Non-resource roles (DiveCenter, Agent, DiveResort, DiveHostel) return null.
 */
const RESOURCE_TYPES: ReadonlySet<string> = new Set(RESOURCE_OWNER_TYPES)

export function effectiveResourceType(roleType: string): ResourceOwnerType | null {
  if (roleType === 'DiveMaster') return 'Instructor'
  return RESOURCE_TYPES.has(roleType) ? (roleType as ResourceOwnerType) : null
}

// ─── Time format validation ──────────────────────────────────────────────────

/** Matches strict HH:MM (two-digit hours, two-digit minutes). */
export const TIME_REGEX = /^\d{2}:\d{2}$/

/** Throws a VALIDATION ConvexError if value is not in HH:MM format. */
export function assertValidTime(value: string, field: string): void {
  if (!TIME_REGEX.test(value)) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, message: `${field} must be HH:MM format` })
  }
}

/** Pads single-digit hours/minutes to HH:MM. Idempotent on already-valid values. */
export function normalizeTime(t: string): string {
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** Canonical gear type validator — use instead of redefining the union inline. */
export const gearTypeValidator = v.union(
  v.literal('wetsuit'),
  v.literal('bcd'),
  v.literal('fins'),
  v.literal('mask'),
  v.literal('regulator'),
)

/** Canonical own/rent validator for individual gear items. */
export const gearRentalValidator = v.union(v.literal('own'), v.literal('rent'))

/** Canonical rental checklist object — shared across schema, portalDraft, customerProfiles. */
export const rentalChecklistValidator = v.object({
  mask: gearRentalValidator,
  bcd: gearRentalValidator,
  wetsuit: gearRentalValidator,
  fins: gearRentalValidator,
  regulator: gearRentalValidator,
  maskPrescription: v.optional(v.string()),
})

/** Base fields required on all profile create mutations. */
export const BASE_PROFILE_CREATE_FIELDS = {
  name: v.string(),
  placeName: v.string(),
  country: v.string(),
  lat: v.number(),
  lng: v.number(),
  email: v.string(),
  phone: v.string(),
}

/** Base fields (all optional) for all profile update mutations. */
export const BASE_PROFILE_UPDATE_FIELDS = {
  name: v.optional(v.string()),
  placeName: v.optional(v.string()),
  country: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
}
