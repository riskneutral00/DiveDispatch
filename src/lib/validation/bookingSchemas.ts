// ── Booking Wizard Step Schemas ────────────────────────────────────────────────
// Zod schemas for each wizard step, plus factory functions for context-dependent
// validation (resources need activityTypes, divers need booking date range).
// These are client-side schemas — convex/ cannot import from src/.

import { z } from 'zod'
import { COURSE_CODES } from '@/lib/constants/course-catalog'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Activities that require an in-system or external instructor. FD is excluded
 *  (Fun Dive is recreational — certified divers need no instruction). */
export const INSTRUCTOR_REQUIRED_CODES = [
  'DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY',
] as const

/** Activities that require confined water (pool). Determines whether the pool
 *  picker is shown and required. */
export const CONFINED_ACTIVITY_CODES = [
  'DSD', 'TRY_DIVE', 'OW', 'REFRESH',
] as const

// ── Session schema ─────────────────────────────────────────────────────────────

const sessionEntrySchema = z
  .object({
    inventoryUnitId: z.string().min(1, 'Inventory unit required'),
    date: z.string().min(1, 'Date required'),
    startTime: z.string().min(1, 'Start time required'),
    endTime: z.string().min(1, 'End time required'),
    timezone: z.string().min(1, 'Timezone required'),
    unitsRequested: z.number().int().min(1, 'Units must be at least 1'),
    deliveryLocation: z.enum(['BoatPier', 'Pool', 'Beach']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time',
      })
    }
  })

/** Client-side sessions validation: at least one session, each structurally valid. */
export const bookingSessionsSchema = z
  .array(sessionEntrySchema)
  .min(1, 'At least one session is required')
  .superRefine((sessions, ctx) => {
    // No duplicate (inventoryUnitId + date + startTime) pairs
    const seen = new Set<string>()
    sessions.forEach((s, i) => {
      const key = `${s.inventoryUnitId}|${s.date}|${s.startTime}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'startTime'],
          message: 'Duplicate session: same unit, date, and start time',
        })
      } else {
        seen.add(key)
      }
    })
  })

export type BookingSessionsData = z.infer<typeof bookingSessionsSchema>

// ── Resources schema factory ───────────────────────────────────────────────────

/**
 * Creates a Zod schema for the resources wizard step.
 *
 * - Instructor required for any activity in INSTRUCTOR_REQUIRED_CODES.
 * - Pool required when `needsPool` is true (any confined-water activity selected).
 * - Equipment Manager is always optional (DC speculates; released at Draft→Upcoming if unused).
 * - Boat, Compressor are optional.
 * - External names (when provided) must be non-empty after trimming — "  " is invalid.
 */
export function makeBookingResourcesSchema(
  activityTypes: readonly string[],
  needsPool: boolean,
) {
  const instructorRequired = activityTypes.some((c) =>
    (INSTRUCTOR_REQUIRED_CODES as readonly string[]).includes(c),
  )

  return z
    .object({
      instructorId: z.string().optional(),
      boatId: z.string().optional(),
      equipmentManagerId: z.string().optional(),
      poolId: z.string().optional(),
      compressorId: z.string().optional(),
      agentId: z.string().optional(),
      agentIsReferral: z.boolean().optional(),
      externalStakeholders: z
        .object({
          instructorName: z.string().optional(),
          boatName: z.string().optional(),
          equipmentManagerName: z.string().optional(),
          poolName: z.string().optional(),
          compressorName: z.string().optional(),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      const ext = data.externalStakeholders ?? {}

      // ── Instructor ──────────────────────────────────────────────────────────
      if (instructorRequired) {
        const hasId = !!data.instructorId
        const hasExtName = !!ext.instructorName?.trim()
        if (!hasId && !hasExtName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['instructorId'],
            message: 'Instructor required for this activity type',
          })
        }
      }
      // Blank external name is invalid even when instructor not strictly required
      if (!data.instructorId && ext.instructorName !== undefined && !ext.instructorName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalStakeholders', 'instructorName'],
          message: 'External instructor name cannot be blank',
        })
      }

      // ── Pool ────────────────────────────────────────────────────────────────
      if (needsPool) {
        const hasId = !!data.poolId
        const hasExtName = !!ext.poolName?.trim()
        if (!hasId && !hasExtName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['poolId'],
            message: 'Pool required for confined water activities',
          })
        }
      }
      if (!data.poolId && ext.poolName !== undefined && !ext.poolName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalStakeholders', 'poolName'],
          message: 'External pool name cannot be blank',
        })
      }

      // ── Optional resources: external name must be non-blank if provided ─────
      if (ext.boatName !== undefined && !ext.boatName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalStakeholders', 'boatName'],
          message: 'External boat name cannot be blank',
        })
      }
      if (ext.equipmentManagerName !== undefined && !ext.equipmentManagerName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalStakeholders', 'equipmentManagerName'],
          message: 'External equipment manager name cannot be blank',
        })
      }
      if (ext.compressorName !== undefined && !ext.compressorName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalStakeholders', 'compressorName'],
          message: 'External compressor name cannot be blank',
        })
      }
    })
}

export type BookingResourcesData = z.infer<ReturnType<typeof makeBookingResourcesSchema>>

// ── Divers schema factory ──────────────────────────────────────────────────────

/**
 * Creates a Zod schema for the divers wizard step.
 *
 * - At least one diver required.
 * - Each diver: name non-empty, abbrev non-empty max 4, flag.code non-empty (nationality),
 *   startDate/endDate within booking date range, activityType min(1) subset of booking's.
 */
export function makeBookingDiversSchema(
  bookingActivityTypes: readonly string[],
  bookingStartDate: string,
  bookingEndDate: string,
) {
  const diverSchema = z
    .object({
      name: z.string().min(1, 'Diver name is required'),
      abbrev: z
        .string()
        .min(1, 'Abbreviation required')
        .max(4, 'Abbreviation must be at most 4 characters'),
      flag: z.object({
        code: z.string().min(1, 'Nationality required'),
        label: z.string(),
      }),
      startDate: z.string().min(1, 'Start date required'),
      endDate: z.string().min(1, 'End date required'),
      agency: z.string().optional(),
      activityType: z
        .array(z.enum(COURSE_CODES))
        .min(1, 'At least one activity type required'),
    })
    .superRefine((data, ctx) => {
      // Diver date order
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date must be on or after start date',
        })
      }
      // Diver dates within booking range
      if (data.startDate && bookingStartDate && data.startDate < bookingStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'Diver start date cannot be before booking start date',
        })
      }
      if (data.endDate && bookingEndDate && data.endDate > bookingEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Diver end date cannot be after booking end date',
        })
      }
      // Per-diver activityType must be a subset of booking's activityType
      const invalid = data.activityType.filter(
        (code) => !bookingActivityTypes.includes(code),
      )
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activityType'],
          message: `Activity '${invalid[0]}' is not in the booking's selected activity types`,
        })
      }
    })

  return z.array(diverSchema).min(1, 'At least one diver is required')
}

export type BookingDiversData = z.infer<ReturnType<typeof makeBookingDiversSchema>>
