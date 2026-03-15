import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Expire Draft bookings whose holdTTL has lapsed — runs every 15 minutes
crons.interval('expire-holds', { minutes: 15 }, internal.bookings.status.expireHolds)

// Auto-complete Upcoming bookings after their last session ends — runs hourly
crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookings)

export default crons
