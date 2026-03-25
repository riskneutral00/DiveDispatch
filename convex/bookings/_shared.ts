/**
 * Barrel re-export for booking domain modules.
 * All callers continue to import from 'bookings/_shared' — zero import changes needed.
 *
 * Split into domain modules by L8-24:
 *   stateMachine.ts  — types, validators, transition guards, time helpers
 *   inventoryRelease.ts — restoreSnapshotUnits, releaseBookingReservations
 *   autoAdvance.ts — tryAutoAdvance (EM auto-release + Draft→Upcoming)
 *   readiness.ts — getBookingReadiness query (DD-067)
 */

export * from './stateMachine'
export * from './inventoryRelease'
export * from './autoAdvance'
export type { BookingReadiness } from './readiness'
