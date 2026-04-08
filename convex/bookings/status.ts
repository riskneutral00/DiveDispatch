import { ConvexError, v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { internalMutation, mutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { authorize } from '../lib/auth'
import {
  canBookingTransition,
  releaseBookingReservations,
  isSessionEnded,
  isBookingExpired,
  tryAutoAdvance,
} from './_shared'
import { logBookingChange } from '../lib/auditLog'
import { notify, notifyReleasedInventory } from '../notifications'
import { ErrorCode } from '../lib/errorCodes'
import { checkRateLimit } from '../lib/rateLimiter'
import { type BookingStatus, BOOKING_STATUS, NOTIFICATION_TYPE, VACATED_REASON } from '../shared/statuses'

export const cancelBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const { user } = await authorize(ctx, null, 'booking:manage', {
      type: 'booking', id: args.bookingId, ownerId: booking.ownerId,
    })
    await checkRateLimit(ctx, 'cancelBooking', user.slug)

    if (!canBookingTransition(booking.status, 'cancel')) {
      throw new ConvexError({
        code: ErrorCode.INVALID_STATUS,
        reason: `Cannot cancel booking in status '${booking.status}'`,
      })
    }

    const vacated = await releaseBookingReservations(ctx, args.bookingId, VACATED_REASON.BookingCancelled)
    await notifyReleasedInventory(ctx, args.bookingId, vacated)

    await ctx.db.patch(args.bookingId, { status: BOOKING_STATUS.Cancelled }) // fsm-ok
    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'cancelled',
      actorSlug: user.slug,
      actorType: 'operator',
    })
  },
})

async function performExpiry(ctx: MutationCtx, bookingId: Id<'bookings'>, currentStatus: BookingStatus) {
  if (!canBookingTransition(currentStatus, 'expire')) {
    return
  }
  await releaseBookingReservations(ctx, bookingId, VACATED_REASON.HoldExpired)
  await ctx.db.patch(bookingId, { status: BOOKING_STATUS.Cancelled }) // fsm-ok
  await logBookingChange(ctx, {
    bookingId,
    action: 'expired',
    actorSlug: 'system',
    actorType: 'system',
  })
}

export const expireBooking = internalMutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return
    await performExpiry(ctx, args.bookingId, booking.status)
  },
})

export const checkAndExpireBooking = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return
    if (!isBookingExpired(booking)) return

    await authorize(ctx, null, 'booking:manage', {
      type: 'booking', id: args.bookingId, ownerId: booking.ownerId,
    })

    await performExpiry(ctx, args.bookingId, booking.status)
  },
})

export const clearMedicalBlock = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    const { user } = await authorize(ctx, null, 'booking:manage', {
      type: 'booking', id: args.bookingId, ownerId: booking.ownerId,
    })

    if (!booking.medicalHardBlock) return

    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', args.bookingId))
      .collect() // bounded: per-booking sessions/reservations

    for (const profile of profiles) {
      if (profile.physicianClearanceRequired) {
        await ctx.db.patch(profile._id, { physicianClearanceRequired: false }) // batch-exempt
      }

      if (profile.customerId) {
        const customer = await ctx.db.get(profile.customerId) // batch-exempt
        if (customer) {
          const flags = customer.flags ?? []
          if (flags.includes('medical_block')) {
            await ctx.db.patch(profile.customerId, { // batch-exempt
              flags: flags.filter((f) => f !== 'medical_block') as ('medical_block')[],
            })
          }
        }
      }
    }

    await ctx.db.patch(args.bookingId, { medicalHardBlock: false })

    await notify(ctx, {
      userId: booking.ownerId,
      type: NOTIFICATION_TYPE.MedicalCleared,
      bookingId: args.bookingId,
      message: 'Medical block cleared: physician clearance reviewed and approved.',
    })

    await logBookingChange(ctx, {
      bookingId: args.bookingId,
      action: 'medical_cleared',
      actorSlug: user.slug,
      actorType: 'operator',
    })

    await tryAutoAdvance(ctx, args.bookingId)
  },
})

async function runCompletionBatch(
  ctx: MutationCtx,
): Promise<{ completed: number; more: boolean }> {
  const upcoming = await ctx.db
    .query('bookings')
    .withIndex('by_status', (q) => q.eq('status', BOOKING_STATUS.Upcoming))
    .take(101)

  const batch = upcoming.slice(0, 100)
  const more = upcoming.length > 100
  let completed = 0

  const sessionsByBooking = await Promise.all(
    batch.map((b) =>
      ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', b._id))
        .collect(), // bounded: per-booking sessions/reservations
    ),
  )

  for (let i = 0; i < batch.length; i++) {
    const booking = batch[i]
    const sessions = sessionsByBooking[i]

    if (sessions.length === 0) continue

    const last = sessions.reduce((latest, s) => {
      if (s.date > latest.date) return s
      if (s.date === latest.date && s.endTime > latest.endTime) return s
      return latest
    })

    if (isSessionEnded(last.date, last.endTime, last.timezone) && canBookingTransition(booking.status, 'complete')) {
      await ctx.db.patch(booking._id, { status: BOOKING_STATUS.Completed }) // fsm-ok // batch-exempt
      await logBookingChange(ctx, { // batch-exempt
        bookingId: booking._id,
        action: 'completed',
        actorSlug: 'system',
        actorType: 'system',
      })
      completed++
    }
  }

  return { completed, more }
}

export const completeBookings = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ completed: number; more: boolean }> => {
    return runCompletionBatch(ctx)
  },
})

export const completeBookingsWithMonitoring = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      const result = await runCompletionBatch(ctx)

      if (result.more) {
        await ctx.scheduler.runAfter(0, internal.bookings.status.completeBookingsWithMonitoring, {})
      }

      await ctx.db.insert('cronRunLog', {
        jobName: 'complete-bookings',
        status: 'success',
        runAt: Date.now(),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      await ctx.db.insert('cronRunLog', {
        jobName: 'complete-bookings',
        status: 'failure',
        error: errorMessage,
        runAt: Date.now(),
      })

      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: 'complete-bookings',
        error: errorMessage,
      })

      throw err
    }
  },
})
