import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireAuth, getAuthUser, HOLD_TTL_MS, assertOwnership } from './lib/auth'
import { checkHasRole, checkHasAnyOperatorRole, requireActiveRole } from './userRoles'
import { OPERATOR_ROLE_SET } from './lib/auth'
import { checkProfileCompleteness } from './lib/profileCompleteness'
import { releaseBookingReservations, assertNoPastDates } from './bookings/_shared'
import { notifyReleasedInventory } from './notifications'
import {
  checkPreferenceCoverage,
  type CoverageInput,
  type BoatCapabilities,
} from './shared/coverageValidation'
import { ErrorCode } from './lib/errorCodes'
import { sanitizeString, NAME_MAX, DRAFT_STATE_MAX } from './lib/sanitize'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { BOOKING_STATUS, VACATED_REASON } from './shared/statuses'

type OperatorType =
  | 'DiveCenter'
  | 'Agent'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'

/**
 * Creates a minimal Draft booking shell. Called once when the wizard first opens
 * for a new booking. Returns bookingId for subsequent saveDraftState calls.
 * Fails fast if caller is not an organizer role.
 *
 * For Agent callers in independent mode: agent is owner, agentId is set for
 * dashboard listing via the by_agentId index.
 * For referral mode use createReferralDraftShell instead.
 */
export const createDraftShell = mutation({
  args: {
    activeRole: stakeholderType,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { user } = await requireAuth(ctx)
    await requireActiveRole(ctx, user._id, args.activeRole)
    if (!OPERATOR_ROLE_SET.has(args.activeRole)) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    // ── Profile completeness gate — operator's active role must be 100% ──
    const activeRoleStatus = await checkProfileCompleteness(ctx, { _id: user._id }, args.activeRole)
    if (activeRoleStatus.percentage < 100) {
      throw new ConvexError({ code: ErrorCode.PROFILE_INCOMPLETE, missing: activeRoleStatus.incomplete })
    }

    /**
     * Past dates — reject if optional startDate is before today.
     * Limitation: drafts have no session context yet, so we default to Asia/Bangkok.
     * When expanding to non-Thailand markets, this call site should accept an
     * explicit timezone from the operator's locale or the draft's target region.
     * See bookingSessions.timezone (schema line 194) for the session-level field.
     */
    if (args.startDate) {
      assertNoPastDates([{ date: args.startDate }])
    }

    // ── Coverage gate — preferred resources must cover all 5 requirements ──
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()

    const prefInstructors = prefs?.preferredInstructorSlugs ?? []
    const prefEquipment = prefs?.preferredEquipmentSlugs ?? []
    const prefVenues = prefs?.preferredVenueSlugs ?? []
    const prefBoats = prefs?.preferredBoatSlugs ?? []
    const prefCompressors = prefs?.preferredCompressorSlugs ?? []

    // Build boat capabilities from the boats table
    const boatCapabilities: Record<string, BoatCapabilities> = {}
    for (const slug of prefBoats) {
      const boatUser = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (boatUser) {
        const boat = await ctx.db
          .query('boats')
          .withIndex('by_userId', (q) => q.eq('userId', boatUser._id))
          .unique()
        if (boat) {
          boatCapabilities[slug] = {
            hasCompressor: boat.hasCompressor,
          }
        }
      }
    }

    const coverageInput: CoverageInput = {
      preferredInstructorSlugs: prefInstructors,
      preferredEquipmentSlugs: prefEquipment,
      preferredVenueSlugs: prefVenues,
      preferredBoatSlugs: prefBoats,
      preferredCompressorSlugs: prefCompressors,
      boatCapabilities,
    }
    const coverage = checkPreferenceCoverage(coverageInput)
    if (!coverage.isComplete) {
      throw new ConvexError({ code: ErrorCode.RESOURCES_INCOMPLETE, missing: coverage.missing })
    }

    // For Agent callers, always stamp agentId so the by_agentId index surfaces this booking.
    const agentId = await checkHasRole(ctx, user._id, 'Agent') ? (user.slug as string) : undefined

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: user.slug,
      ownerType: args.activeRole as OperatorType,
      status: BOOKING_STATUS.Draft,
      createdAt: Date.now(),
      holdTTL: HOLD_TTL_MS,
      paid: false,
      activityType: [],
      startDate: args.startDate ?? '',
      endDate: args.endDate ?? '',
      divers: [],
      agentId,
      operatorName: sanitizeString(user.businessName ?? '', NAME_MAX),
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      medicalHardBlock: false,
      bookingFormComplete: false,
      customerFormComplete: false,
    })

    // Clean up demo bookings after first real booking creation
    await ctx.scheduler.runAfter(0, internal.demoBookings.cleanupDemoBookings, {
      ownerId: user.slug,
    })

    return bookingId as string
  },
})

/**
 * Creates a referral Draft booking shell. Agent refers a customer to a DC —
 * the DC becomes the booking owner and handles the booking from here.
 * Agent's involvement ends after this call; they can track via by_agentId index.
 */
export const createReferralDraftShell = mutation({
  args: {
    referralDcSlug: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { user } = await requireAuth(ctx)
    if (!await checkHasRole(ctx, user._id, 'Agent')) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    const dcUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', args.referralDcSlug))
      .unique()
    if (!dcUser) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    // Determine the DC's operator role from their assigned roles
    const dcRoles = await ctx.db
      .query('userRoles')
      .withIndex('by_userId', (q) => q.eq('userId', dcUser._id))
      .collect()
    const dcOperatorRole = dcRoles.find((r) => OPERATOR_ROLE_SET.has(r.role))
    if (!dcOperatorRole) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    // Enforce profile + resource completeness on the target DC
    const dcRoleStatus = await checkProfileCompleteness(ctx, { _id: dcUser._id }, dcOperatorRole.role)
    if (dcRoleStatus.percentage < 100) {
      throw new ConvexError({ code: ErrorCode.PROFILE_INCOMPLETE, missing: dcRoleStatus.incomplete })
    }

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: dcUser.slug as string,
      ownerType: dcOperatorRole.role as OperatorType,
      status: BOOKING_STATUS.Draft,
      createdAt: Date.now(),
      holdTTL: HOLD_TTL_MS,
      paid: false,
      activityType: [],
      startDate: '',
      endDate: '',
      divers: [],
      agentId: user.slug as string,
      agentIsReferral: true,
      // operatorName is the DC's business name since they own the booking
      operatorName: sanitizeString(dcUser.businessName ?? '', NAME_MAX),
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      medicalHardBlock: false,
      bookingFormComplete: false,
      customerFormComplete: false,
    })

    return bookingId as string
  },
})

/**
 * Persists the serialized wizard state to bookings.draftState.
 * Called on every step change so operators can resume later via edit mode.
 * Only allowed on Draft bookings owned by the caller.
 */
export const saveDraftState = mutation({
  args: {
    bookingId: v.id('bookings'),
    draftState: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership(booking, user)
    if (booking.status !== BOOKING_STATUS.Draft) throw new ConvexError({ code: ErrorCode.INVALID_STATUS })

    await ctx.db.patch(args.bookingId, { draftState: sanitizeString(args.draftState, DRAFT_STATE_MAX) })
  },
})

/**
 * Returns a booking owned by the caller for the wizard to pre-fill.
 * Returns null if not found or caller does not own it.
 * Used by edit mode to restore draftState or pre-fill from booking fields.
 */
export const getBookingForWizard = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) return null

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return null
    if (booking.ownerId !== user.slug) return null

    return booking
  },
})

/**
 * Hard-deletes a Draft booking owned by the caller.
 * Vacates any active reservations, deletes sessions and booking links,
 * then removes the booking record entirely.
 * Used by the operator to discard in-progress wizard sessions.
 */
export const discardDraft = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    assertOwnership(booking, user)
    if (booking.status !== BOOKING_STATUS.Draft) throw new ConvexError({ code: ErrorCode.INVALID_STATUS })

    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.BookingCancelled)
    await notifyReleasedInventory(ctx, args.bookingId, vacated)

    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const s of sessions) {
      await ctx.db.delete(s._id) // batch-exempt: sequential hard-delete of orphaned session rows required before booking deletion
    }

    const links = await ctx.db
      .query('bookingLinks')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const l of links) {
      await ctx.db.delete(l._id) // batch-exempt: sequential hard-delete of orphaned link rows required before booking deletion
    }

    // Delete all customerProfiles for this booking (orphaned after booking deletion)
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const p of profiles) {
      await ctx.db.delete(p._id) // batch-exempt: sequential hard-delete of orphaned profile rows required before booking deletion
    }

    // Delete all equipmentBags assigned to this booking (orphaned after booking deletion)
    const bags = await ctx.db
      .query('equipmentBags')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const b of bags) {
      await ctx.db.delete(b._id) // batch-exempt: sequential hard-delete of orphaned bag rows required before booking deletion
    }

    // Hard-delete all reservations for this booking — includes vacated ones from prior
    // edit cycles that releaseBookingReservations skipped (already Vacated). Leaving
    // them would orphan records referencing a deleted bookingId.
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const r of reservations) {
      await ctx.db.delete(r._id) // batch-exempt: sequential hard-delete of all reservation rows (including already-vacated) required before booking deletion
    }

    // Delete audit log entries for this booking (DD-157)
    const auditLogs = await ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const a of auditLogs) {
      await ctx.db.delete(a._id) // batch-exempt: sequential hard-delete of orphaned audit log rows required before booking deletion
    }

    // Delete booking resource assignments for this booking (DD-157)
    const resources = await ctx.db
      .query('bookingResources')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const br of resources) {
      await ctx.db.delete(br._id) // batch-exempt: sequential hard-delete of orphaned resource rows required before booking deletion
    }

    await ctx.db.delete(args.bookingId)
  },
})
