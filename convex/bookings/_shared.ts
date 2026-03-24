/**
 * Barrel re-export for booking domain modules.
 * All callers continue to import from 'bookings/_shared' — zero import changes needed.
 *
 * Split into domain modules by L8-24:
 *   state-machine.ts  — types, validators, transition guards, time helpers
 *   inventory-release.ts — restoreSnapshotUnits, releaseBookingReservations
 *   auto-advance.ts — tryAutoAdvance (EM auto-release + Draft→Upcoming)
 */

export * from './state-machine'
export * from './inventory-release'
export * from './auto-advance'
