import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Auto-complete Upcoming bookings after their last session ends — runs hourly
crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookings)

export default crons
