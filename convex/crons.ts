import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Auto-complete Upcoming bookings after their last session ends — runs hourly
crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookingsWithMonitoring)

// Purge stale rate limit entries to prevent unbounded table growth from portal token keys
crons.interval('purge-rate-limits', { hours: 24 }, internal.lib.rateLimiter.purgeStaleRateLimits)

// Prune past dates from stakeholderBlockedDates to prevent unbounded array growth
crons.interval('prune-blocked-dates', { hours: 168 }, internal.availability.pruneBlockedDates)

// Expire stale Draft bookings whose holdTTL has lapsed — belt-and-suspenders to catch
// bookings the lazy client check (useBookingWithExpiry) never triggered
crons.interval('expire-stale-bookings', { hours: 2 }, internal.bookings.status.expireStaleBookings)

// Purge expired idempotency keys to prevent unbounded table growth from offline mutation replay
crons.interval('purge-idempotency-keys', { hours: 1 }, internal.lib.idempotency.purgeExpiredIdempotencyKeys)

export default crons
