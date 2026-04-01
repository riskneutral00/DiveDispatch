/**
 * @module-tag slow
 */

/**
 * State-machine hardening tests.
 *
 * Pure function tests: every INVALID booking and reservation transition returns false.
 * Mutation tests: verify the guard actually rejects at the mutation layer.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../../convex/_generated/api'
import {
  canBookingTransition,
  canReservationTransition,
} from '../../convex/bookings/stateMachine'
import { seedUser, seedBooking as _seedBooking, type SeedCtx } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Parameters<typeof _seedBooking>[1] = {},
) {
  return _seedBooking(ctx, { ownerId, bookingFormComplete: false, ...overrides })
}

// ─── Invalid Booking Transitions (pure function) ─────────────────────────────

describe('canBookingTransition — invalid transitions', () => {
  // Draft: can only confirm or cancel
  it('rejects Draft → complete (must go through Upcoming first)', () => {
    expect(canBookingTransition('Draft', 'complete')).toBe(false)
  })

  it('rejects Draft → edit (can\'t edit a draft — it\'s already editable)', () => {
    expect(canBookingTransition('Draft', 'edit')).toBe(false)
  })

  // Upcoming: can only edit, cancel, or complete
  it('rejects Upcoming → confirm (already confirmed)', () => {
    expect(canBookingTransition('Upcoming', 'confirm')).toBe(false)
  })

  // Completed: can only edit or cancel
  it('rejects Completed → confirm (terminal status for confirm)', () => {
    expect(canBookingTransition('Completed', 'confirm')).toBe(false)
  })

  it('rejects Completed → complete (already completed)', () => {
    expect(canBookingTransition('Completed', 'complete')).toBe(false)
  })

  // Cancelled: no transitions allowed except none
  it('rejects Cancelled → confirm (cancelled bookings cannot be revived)', () => {
    expect(canBookingTransition('Cancelled', 'confirm')).toBe(false)
  })

  it('rejects Cancelled → complete (cancelled bookings cannot complete)', () => {
    expect(canBookingTransition('Cancelled', 'complete')).toBe(false)
  })

  it('rejects Cancelled → cancel (already cancelled)', () => {
    expect(canBookingTransition('Cancelled', 'cancel')).toBe(false)
  })

  it('rejects Cancelled → edit (cancelled bookings cannot be edited)', () => {
    expect(canBookingTransition('Cancelled', 'edit')).toBe(false)
  })
})

// ─── Invalid Reservation Transitions (pure function) ─────────────────────────

describe('canReservationTransition — invalid transitions', () => {
  // PendingAcceptance: can only accept or vacate
  it('rejects PendingAcceptance → mark_noshow (must be Confirmed first)', () => {
    expect(canReservationTransition('PendingAcceptance', 'mark_noshow')).toBe(false)
  })

  it('rejects PendingAcceptance → revert_noshow (was never marked NoShow)', () => {
    expect(canReservationTransition('PendingAcceptance', 'revert_noshow')).toBe(false)
  })

  // Confirmed: can only vacate or mark_noshow
  it('rejects Confirmed → accept (already accepted)', () => {
    expect(canReservationTransition('Confirmed', 'accept')).toBe(false)
  })

  it('rejects Confirmed → revert_noshow (not in NoShow status)', () => {
    expect(canReservationTransition('Confirmed', 'revert_noshow')).toBe(false)
  })

  // Vacated: terminal — no transitions allowed
  it('rejects Vacated → accept (vacated reservations cannot be accepted)', () => {
    expect(canReservationTransition('Vacated', 'accept')).toBe(false)
  })

  it('rejects Vacated → vacate (already vacated)', () => {
    expect(canReservationTransition('Vacated', 'vacate')).toBe(false)
  })

  it('rejects Vacated → mark_noshow (vacated reservations cannot be marked NoShow)', () => {
    expect(canReservationTransition('Vacated', 'mark_noshow')).toBe(false)
  })

  it('rejects Vacated → revert_noshow (vacated reservations cannot revert)', () => {
    expect(canReservationTransition('Vacated', 'revert_noshow')).toBe(false)
  })

  // NoShow: can only revert_noshow
  it('rejects NoShow → accept (NoShow reservations cannot be accepted)', () => {
    expect(canReservationTransition('NoShow', 'accept')).toBe(false)
  })

  it('rejects NoShow → vacate (NoShow reservations cannot be vacated directly)', () => {
    expect(canReservationTransition('NoShow', 'vacate')).toBe(false)
  })

  it('rejects NoShow → mark_noshow (already marked NoShow)', () => {
    expect(canReservationTransition('NoShow', 'mark_noshow')).toBe(false)
  })
})

// ─── Mutation-level guards ───────────────────────────────────────────────────

describe('cancelBooking mutation — INVALID_STATUS guard', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => {
    t = makeT()
  })

  it('throws INVALID_STATUS when booking is already Cancelled', async () => {
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })
})

describe('editBooking mutation — INVALID_STATUS guard', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => {
    t = makeT()
  })

  it('throws INVALID_STATUS when booking is Cancelled', async () => {
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })
})
