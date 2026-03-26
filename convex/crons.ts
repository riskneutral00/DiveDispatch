import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Auto-complete Upcoming bookings after their last session ends — runs hourly
crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookingsWithMonitoring)

// Purge stale rate limit entries to prevent unbounded table growth from portal token keys
crons.interval('purge-rate-limits', { hours: 24 }, internal.lib.rateLimiter.purgeStaleRateLimits)

export default crons
