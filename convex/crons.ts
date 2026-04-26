import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('complete-bookings', { hours: 1 }, internal.bookings.status.completeBookingsWithMonitoring)

crons.interval('purge-rate-limits', { hours: 24 }, internal.lib.rateLimiter.purgeStaleRateLimits)

crons.interval('prune-blocked-dates', { hours: 168 }, internal.availability.pruneBlockedDates)

crons.interval('purge-idempotency-keys', { hours: 1 }, internal.lib.idempotency.purgeExpiredIdempotencyKeys)

crons.interval('purge-expired-drafts', { hours: 6 }, internal.bookings.inventoryRelease.purgeExpiredDrafts)

crons.interval('reconcile-snapshots', { hours: 12 }, internal.reconciliation.reconcileSnapshots)

crons.interval('purge-soft-deleted-orgs', { hours: 24 }, internal.organizations.purgeSoftDeletedOrgs)

export default crons
