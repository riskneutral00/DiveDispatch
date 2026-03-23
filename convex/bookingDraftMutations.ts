import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireAuth, getAuthUser, OPERATOR_ROLE_SET, HOLD_TTL_MS } from './lib/auth'
import { checkProfileCompleteness } from './lib/profileCompleteness'
import { releaseBookingReservations, assertNoPastDates } from './bookings/_shared'
import {
  checkPreferenceCoverage,
  type CoverageInput,
  type VenueCapabilities,
  type BoatCapabilities,
} from '../src/lib/booking/coverage-validation'

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
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { user } = await requireAuth(ctx)
    if (!OPERATOR_ROLE_SET.has(user.role)) throw new ConvexError({ code: 'FORBIDDEN' })

    // ── Profile completeness gate — must be 100% to create bookings ──
    const profileStatus = await checkProfileCompleteness(ctx, user)
    if (profileStatus.percentage < 100) {
      throw new ConvexError({ code: 'PROFILE_INCOMPLETE', missing: profileStatus.incomplete })
    }

    // Past dates — reject if optional startDate is before today
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

    // Build venue capabilities from the venues table
    const venueCapabilities: Record<string, VenueCapabilities> = {}
    for (const slug of prefVenues) {
      const venueUser = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (venueUser) {
        const venue = await ctx.db
          .query('venues')
          .withIndex('by_userId', (q) => q.eq('userId', venueUser._id))
          .unique()
        if (venue) {
          venueCapabilities[slug] = {
            confinedCapable: venue.confinedCapable,
            openWaterCapable: venue.openWaterCapable,
            hasCompressor: venue.hasCompressor,
          }
        }
      }
    }

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
      venueCapabilities,
      boatCapabilities,
    }
    const coverage = checkPreferenceCoverage(coverageInput)
    if (!coverage.isComplete) {
      throw new ConvexError({ code: 'COVERAGE_INCOMPLETE', missing: coverage.missing })
    }

    // For Agent callers, always stamp agentId so the by_agentId index surfaces this booking.
    const agentId = user.role === 'Agent' ? (user.slug as string) : undefined

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: user.slug,
      ownerType: user.role as OperatorType,
      status: 'Draft' as const,
      createdAt: Date.now(),
      holdTTL: HOLD_TTL_MS,
      paid: false,
      activityType: [],
      startDate: args.startDate ?? '',
      endDate: args.endDate ?? '',
      divers: [],
      agentId,
      operatorName: user.businessName,
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
    if (user.role !== 'Agent') throw new ConvexError({ code: 'FORBIDDEN' })

    const dcUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', args.referralDcSlug))
      .unique()
    if (!dcUser) throw new ConvexError({ code: 'NOT_FOUND' })
    if (!OPERATOR_ROLE_SET.has(dcUser.role as string)) {
      throw new ConvexError({ code: 'FORBIDDEN' })
    }

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: dcUser.slug as string,
      ownerType: dcUser.role as OperatorType,
      status: 'Draft' as const,
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
      operatorName: dcUser.businessName as string,
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
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })
    if (booking.status !== 'Draft') throw new ConvexError({ code: 'INVALID_STATUS' })

    await ctx.db.patch(args.bookingId, { draftState: args.draftState })
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
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })
    if (booking.status !== 'Draft') throw new ConvexError({ code: 'INVALID_STATUS' })

    await releaseBookingReservations(ctx, args.bookingId, 'booking_cancelled')

    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const s of sessions) {
      await ctx.db.delete(s._id)
    }

    const links = await ctx.db
      .query('bookingLinks')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const l of links) {
      await ctx.db.delete(l._id)
    }

    // Delete all customerProfiles for this booking (orphaned after booking deletion)
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const p of profiles) {
      await ctx.db.delete(p._id)
    }

    // Delete all equipmentBags assigned to this booking (orphaned after booking deletion)
    const bags = await ctx.db
      .query('equipmentBags')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const b of bags) {
      await ctx.db.delete(b._id)
    }

    // Hard-delete all reservations for this booking — includes vacated ones from prior
    // edit cycles that releaseBookingReservations skipped (already Vacated). Leaving
    // them would orphan records referencing a deleted bookingId.
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const r of reservations) {
      await ctx.db.delete(r._id)
    }

    await ctx.db.delete(args.bookingId)
  },
})
