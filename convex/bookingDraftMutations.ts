import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { authorize, authorizeWithRole, getAuthUser, getRequiredUserBySlug, HOLD_TTL_MS } from './lib/auth'
import { profileByUserId } from './lib/profileHelpers'
import { getAllUserRoles } from './lib/userRoleHelpers'
import { checkHasRole, checkHasAnyOperatorRole, requireActiveRole, requireRoleReadiness } from './userRoles'
import { OPERATOR_ROLE_SET } from './lib/auth'
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
import type { OperatorType } from './shared/operatorTypes'

export const createDraftShell = mutation({
  args: {
    activeRole: stakeholderType,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!OPERATOR_ROLE_SET.has(args.activeRole)) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    const { user } = await authorizeWithRole(ctx, 'booking:manage', args.activeRole, { type: 'booking' }, { requireReadiness: true })

    if (args.startDate) {
      assertNoPastDates([{ date: args.startDate }])
    }

    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', user.slug))
      .unique()

    const prefInstructors = prefs?.preferredInstructorSlugs ?? []
    const prefEquipment = prefs?.preferredEquipmentSlugs ?? []
    const prefVenues = prefs?.preferredVenueSlugs ?? []
    const prefBoats = prefs?.preferredBoatSlugs ?? []
    const prefCompressors = prefs?.preferredCompressorSlugs ?? []

    const boatCapabilities: Record<string, BoatCapabilities> = {}
    const boatEntries = await Promise.all(
      prefBoats.map(async (slug) => {
        const boatUser = await ctx.db
          .query('users')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique()
        if (!boatUser) return null
        const boat = await profileByUserId(ctx, boatUser._id, 'boats')
        if (!boat) return null
        return { slug, hasCompressor: boat.hasCompressor } as const
      }),
    )
    for (const entry of boatEntries) {
      if (entry) boatCapabilities[entry.slug] = { hasCompressor: entry.hasCompressor }
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

    await ctx.scheduler.runAfter(0, internal.demoBookings.cleanupDemoBookings, {
      ownerId: user.slug,
    })

    return bookingId as string
  },
})

export const createReferralDraftShell = mutation({
  args: {
    referralDcSlug: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { user } = await authorize(ctx, null, 'booking:manage', { type: 'booking' })
    if (!await checkHasRole(ctx, user._id, 'Agent')) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    const dcUser = await getRequiredUserBySlug(ctx, args.referralDcSlug)

    const dcRoles = await getAllUserRoles(ctx, dcUser._id)
    const dcOperatorRole = dcRoles.find((r) => OPERATOR_ROLE_SET.has(r.role))
    if (!dcOperatorRole) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    await requireRoleReadiness(ctx, dcUser._id, dcOperatorRole.role)

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

export const saveDraftState = mutation({
  args: {
    bookingId: v.id('bookings'),
    draftState: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await authorize(ctx, null, 'booking:manage', { type: 'booking', ownerId: booking.ownerId })
    if (booking.status !== BOOKING_STATUS.Draft) throw new ConvexError({ code: ErrorCode.INVALID_STATUS })

    await ctx.db.patch(args.bookingId, { draftState: sanitizeString(args.draftState, DRAFT_STATE_MAX) })
  },
})

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

export const discardDraft = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    await authorize(ctx, null, 'booking:manage', { type: 'booking', ownerId: booking.ownerId })
    if (booking.status !== BOOKING_STATUS.Draft) throw new ConvexError({ code: ErrorCode.INVALID_STATUS })

    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.BookingCancelled)
    await notifyReleasedInventory(ctx, args.bookingId, vacated)

    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const s of sessions) {
      await ctx.db.delete(s._id) // batch-exempt: sequential hard-delete of orphaned session rows required before booking deletion
    }

    const links = await ctx.db
      .query('bookingLinks')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const l of links) {
      await ctx.db.delete(l._id) // batch-exempt: sequential hard-delete of orphaned link rows required before booking deletion
    }

    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const p of profiles) {
      await ctx.db.delete(p._id) // batch-exempt: sequential hard-delete of orphaned profile rows required before booking deletion
    }

    const bags = await ctx.db
      .query('equipmentBags')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const b of bags) {
      await ctx.db.delete(b._id) // batch-exempt: sequential hard-delete of orphaned bag rows required before booking deletion
    }

    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const r of reservations) {
      await ctx.db.delete(r._id) // batch-exempt: sequential hard-delete of all reservation rows (including already-vacated) required before booking deletion
    }

    const auditLogs = await ctx.db
      .query('bookingAuditLog')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const a of auditLogs) {
      await ctx.db.delete(a._id) // batch-exempt: sequential hard-delete of orphaned audit log rows required before booking deletion
    }

    const resources = await ctx.db
      .query('bookingResources')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking scope
    for (const br of resources) {
      await ctx.db.delete(br._id) // batch-exempt: sequential hard-delete of orphaned resource rows required before booking deletion
    }

    await ctx.db.delete(args.bookingId)
  },
})
