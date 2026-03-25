import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Auto-complete Upcoming bookings after their last session ends — runs hourly
// Wrapped version logs every run to cronRunLog and alerts on failure
crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookingsWithMonitoring)

export default crons
