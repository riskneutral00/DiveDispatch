import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { authorize, authorizeWithRole, getAuthUser, getRequiredUserBySlug, HOLD_TTL_MS } from './lib/auth'
import { profileByUserId } from './lib/profileHelpers'
import { getAllUserRoles } from './lib/userRoleHelpers'
import { requireRoleReadiness } from './userRoles'
import { OPERATOR_ROLE_SET } from './lib/auth'
import { releaseBookingReservations, assertNoPastDates } from './bookings/_shared'
import { notify, notifyReleasedInventory } from './notifications'
import { logBookingChange } from './lib/auditLog'
import {
  checkPreferenceCoverage,
  type CoverageInput,
  type BoatCapabilities,
} from './shared/coverageValidation'
import { ErrorCode } from './lib/errorCodes'
import { sanitizeString, NAME_MAX, DRAFT_STATE_MAX } from './lib/sanitize'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { BOOKING_STATUS, NOTIFICATION_TYPE, VACATED_REASON } from './shared/statuses'
import type { OperatorType } from './shared/operatorTypes'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function assertPristineDraft(ctx: MutationCtx, bookingId: Id<'bookings'>): Promise<void> {
  const [reservations, sessions, links, profiles, resources, bags] = await Promise.all([
    ctx.db.query('reservations').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
    ctx.db.query('bookingSessions').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
    ctx.db.query('bookingLinks').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
    ctx.db.query('customerProfiles').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
    ctx.db.query('bookingResources').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
    ctx.db.query('equipmentBags').withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId)).take(1),
  ])
  if (
    reservations.length > 0 ||
    sessions.length > 0 ||
    links.length > 0 ||
    profiles.length > 0 ||
    resources.length > 0 ||
    bags.length > 0
  ) {
    throw new ConvexError({ code: ErrorCode.INVALID_STATUS, reason: 'booking is not pristine draft' })
  }
}

export const createDraftShell = mutation({
  args: {
    activeRole: stakeholderType,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    isReferral: v.optional(v.boolean()),
    targetOperatorSlug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!OPERATOR_ROLE_SET.has(args.activeRole)) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    if (args.startDate) {
      assertNoPastDates([{ date: args.startDate }])
    }

    const isReferral = args.isReferral === true

    if (isReferral) {
      const { user } = await authorizeWithRole(ctx, 'booking:manage', args.activeRole, { type: 'booking' }, { requireReadiness: true })

      if (!args.targetOperatorSlug) {
        throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: 'targetOperatorSlug required for referral' })
      }
      if (args.targetOperatorSlug === user.slug) {
        throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'self-referral' })
      }

      const targetUser = await getRequiredUserBySlug(ctx, args.targetOperatorSlug)
      const targetRoles = await getAllUserRoles(ctx, targetUser._id)
      const targetOperatorRole = targetRoles.find((r) => OPERATOR_ROLE_SET.has(r.role))
      if (!targetOperatorRole) throw new ConvexError({ code: ErrorCode.FORBIDDEN })
      await requireRoleReadiness(ctx, targetUser._id, targetOperatorRole.role)

      const bookingId = await ctx.db.insert('bookings', {
        ownerId: targetUser.slug as string,
        ownerType: targetOperatorRole.role as OperatorType,
        status: BOOKING_STATUS.Draft,
        createdAt: Date.now(),
        holdTTL: HOLD_TTL_MS,
        paid: false,
        activityType: [],
        startDate: args.startDate ?? '',
        endDate: args.endDate ?? '',
        divers: [],
        referrerId: user.slug as string,
        referrerType: args.activeRole as OperatorType,
        operatorName: sanitizeString(targetUser.businessName ?? '', NAME_MAX),
        portalContact: true,
        portalMedical: true,
        portalWaiver: true,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })

      await notify(ctx, {
        userId: targetUser.slug as string,
        type: NOTIFICATION_TYPE.BookingReferred,
        bookingId,
        message: `New referral from ${sanitizeString(user.businessName ?? user.slug, NAME_MAX)}`,
      })

      await logBookingChange(ctx, {
        bookingId,
        action: 'referral_handoff',
        actorSlug: user.slug as string,
        actorType: 'operator',
        diff: JSON.stringify({
          referrerId: user.slug,
          referrerType: args.activeRole,
          ownerId: targetUser.slug,
          ownerType: targetOperatorRole.role,
        }),
      })

      return bookingId as string
    }

    const { user } = await authorizeWithRole(ctx, 'booking:manage', args.activeRole, { type: 'booking' }, { requireReadiness: true })

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

export const returnReferralToReferrer = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    const { user } = await authorize(ctx, null, 'booking:manage', { type: 'booking', ownerId: booking.ownerId })

    if (booking.status !== BOOKING_STATUS.Draft) {
      throw new ConvexError({ code: ErrorCode.INVALID_STATUS })
    }
    if (!booking.referrerId || !booking.referrerType) {
      throw new ConvexError({ code: ErrorCode.INVALID_STATUS, reason: 'not a referred booking' })
    }
    if (!OPERATOR_ROLE_SET.has(booking.referrerType)) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'referrer role not operator' })
    }
    if (booking.returnedToReferrerAt !== undefined) {
      throw new ConvexError({ code: ErrorCode.INVALID_STATUS, reason: 'already returned' })
    }

    await assertPristineDraft(ctx, args.bookingId)

    const referrerUser = await getRequiredUserBySlug(ctx, booking.referrerId)
    const referrerRoles = await getAllUserRoles(ctx, referrerUser._id)
    const referrerRole = referrerRoles.find((r) => r.role === booking.referrerType)
    if (!referrerRole) throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'referrer role missing' })
    await requireRoleReadiness(ctx, referrerUser._id, referrerRole.role)

    const oldOwnerId = booking.ownerId
    const oldOwnerType = booking.ownerType
    const newOwnerId = referrerUser.slug as string
    const newOwnerType = booking.referrerType as OperatorType

    await ctx.db.patch(args.bookingId, {
      ownerId: newOwnerId,
      ownerType: newOwnerType,
      operatorName: sanitizeString(referrerUser.businessName ?? '', NAME_MAX),
      returnedToReferrerAt: Date.now(),
    })

    await notify(ctx, {
      userId: newOwnerId,
      type: NOTIFICATION_TYPE.BookingReferred,
      bookingId: args.bookingId,
      message: `Referral returned by ${sanitizeString(user.businessName ?? user.slug, NAME_MAX)}`,
    })

    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'referral_returned',
      actorSlug: user.slug as string,
      actorType: 'operator',
      diff: JSON.stringify({
        ownerId: { old: oldOwnerId, new: newOwnerId },
        ownerType: { old: oldOwnerType, new: newOwnerType },
      }),
    })
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
