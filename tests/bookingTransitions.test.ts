import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConvexError } from 'convex/values'

// Mock generated Convex server bindings — mutation/internalMutation become
// pass-through so we can call .handler() directly in tests.
vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
}))

import {
  canBookingTransition,
  canReservationTransition,
  cancelBooking,
  editBooking,
} from '../convex/bookingsMutations'

// After vi.mock, cancelBooking / editBooking are the raw config objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutationConfig = { args: unknown; handler: (ctx: any, args: any) => Promise<unknown> }

const cancel = cancelBooking as unknown as MutationConfig
const edit = editBooking as unknown as MutationConfig

// ─── Mock context factory ─────────────────────────────────────────────────────

function makeCtx(opts: {
  identity?: unknown
  user?: unknown
  booking?: unknown
  reservations?: unknown[]
  sessions?: unknown[]
} = {}) {
  // Use !== undefined so callers can pass null to simulate missing identity/user
  const identity = opts.identity !== undefined ? opts.identity : { tokenIdentifier: 'tok_test' }
  const user = opts.user !== undefined ? opts.user : { _id: 'user-1', slug: 'owner-slug' }
  const booking = opts.booking !== undefined ? opts.booking : null
  const reservations = opts.reservations ?? []
  const sessions = opts.sessions ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    get: vi.fn(async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (id === (booking as any)?._id) return booking
      return null
    }),
    patch: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    // Table-aware query mock: returns user for .unique(), correct list for .collect()
    query: vi.fn((table: string) => ({
      withIndex: vi.fn(() => ({
        unique: vi.fn(async () => (table === 'users' ? user : null)),
        collect: vi.fn(async () => {
          if (table === 'reservations') return reservations
          if (table === 'bookingSessions') return sessions
          if (table === 'availabilitySnapshots') return []
          if (table === 'bookingLinks') return []
          return []
        }),
      })),
    })),
  }

  return {
    auth: { getUserIdentity: vi.fn(async () => identity) },
    db,
  }
}

// ─── canBookingTransition ─────────────────────────────────────────────────────

describe('canBookingTransition', () => {
  describe('confirm (Draft → Upcoming)', () => {
    it('allows from Draft', () => expect(canBookingTransition('Draft', 'confirm')).toBe(true))
    it('rejects from Upcoming', () => expect(canBookingTransition('Upcoming', 'confirm')).toBe(false))
    it('rejects from Completed', () => expect(canBookingTransition('Completed', 'confirm')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'confirm')).toBe(false))
  })

  describe('edit (→ Draft)', () => {
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'edit')).toBe(true))
    it('allows from Completed', () => expect(canBookingTransition('Completed', 'edit')).toBe(true))
    it('rejects from Draft', () => expect(canBookingTransition('Draft', 'edit')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'edit')).toBe(false))
  })

  describe('cancel (→ Cancelled)', () => {
    it('allows from Draft', () => expect(canBookingTransition('Draft', 'cancel')).toBe(true))
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'cancel')).toBe(true))
    it('allows from Completed', () => expect(canBookingTransition('Completed', 'cancel')).toBe(true))
    it('rejects from Cancelled (already cancelled)', () => {
      expect(canBookingTransition('Cancelled', 'cancel')).toBe(false)
    })
  })

  describe('complete (Upcoming → Completed)', () => {
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'complete')).toBe(true))
    it('rejects from Draft', () => expect(canBookingTransition('Draft', 'complete')).toBe(false))
    it('rejects from Completed', () => expect(canBookingTransition('Completed', 'complete')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'complete')).toBe(false))
  })
})

// ─── canReservationTransition ─────────────────────────────────────────────────

describe('canReservationTransition', () => {
  describe('accept', () => {
    it('allows from PendingAcceptance', () => {
      expect(canReservationTransition('PendingAcceptance', 'accept')).toBe(true)
    })
    it('rejects from Confirmed', () => expect(canReservationTransition('Confirmed', 'accept')).toBe(false))
    it('rejects from Vacated', () => expect(canReservationTransition('Vacated', 'accept')).toBe(false))
    it('rejects from NoShow', () => expect(canReservationTransition('NoShow', 'accept')).toBe(false))
  })

  describe('vacate', () => {
    it('allows from PendingAcceptance', () => {
      expect(canReservationTransition('PendingAcceptance', 'vacate')).toBe(true)
    })
    it('allows from Confirmed', () => expect(canReservationTransition('Confirmed', 'vacate')).toBe(true))
    it('rejects from Vacated', () => expect(canReservationTransition('Vacated', 'vacate')).toBe(false))
    it('rejects from NoShow', () => expect(canReservationTransition('NoShow', 'vacate')).toBe(false))
  })
})

// ─── cancelBooking ────────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx({ identity: null })
    await expect(cancel.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'UNAUTHENTICATED' },
    })
  })

  it('throws NOT_FOUND when booking does not exist', async () => {
    const ctx = makeCtx({ booking: null })
    await expect(cancel.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'NOT_FOUND' },
    })
  })

  it('throws FORBIDDEN when caller does not own the booking', async () => {
    const ctx = makeCtx({
      user: { _id: 'user-1', slug: 'other-slug' },
      booking: { _id: 'booking-1', ownerId: 'owner-slug', status: 'Draft' },
    })
    await expect(cancel.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' },
    })
  })

  it('throws INVALID_STATUS when booking is already Cancelled', async () => {
    const ctx = makeCtx({
      booking: { _id: 'booking-1', ownerId: 'owner-slug', status: 'Cancelled' },
    })
    await expect(cancel.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'INVALID_STATUS' },
    })
  })

  it('cancels a Draft booking — patches status to Cancelled', async () => {
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Draft' }
    const ctx = makeCtx({ booking, reservations: [] })
    await cancel.handler(ctx, { bookingId: 'booking-1' })
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', { status: 'Cancelled' })
  })

  it('cancels an Upcoming booking and vacates active reservations', async () => {
    const reservation = {
      _id: 'res-1',
      status: 'Confirmed',
      bookingSessionId: 'session-1',
      inventoryUnitId: 'unit-1',
      unitsRequested: 1,
    }
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Upcoming' }
    const ctx = makeCtx({ booking, reservations: [reservation] })
    await cancel.handler(ctx, { bookingId: 'booking-1' })

    // Reservation vacated
    expect(ctx.db.patch).toHaveBeenCalledWith('res-1', expect.objectContaining({
      status: 'Vacated',
      vacatedBy: 'booking_cancelled',
    }))
    // Booking cancelled
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', { status: 'Cancelled' })
  })

  it('cancels a Completed booking', async () => {
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Completed' }
    const ctx = makeCtx({ booking, reservations: [] })
    await cancel.handler(ctx, { bookingId: 'booking-1' })
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', { status: 'Cancelled' })
  })

  it('skips Vacated reservations during cancel', async () => {
    const vacated = {
      _id: 'res-1',
      status: 'Vacated',
      bookingSessionId: 'session-1',
      inventoryUnitId: 'unit-1',
      unitsRequested: 1,
    }
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Draft' }
    const ctx = makeCtx({ booking, reservations: [vacated] })
    await cancel.handler(ctx, { bookingId: 'booking-1' })
    // Only the booking patch, not the reservation
    expect(ctx.db.patch).toHaveBeenCalledTimes(1)
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', { status: 'Cancelled' })
  })
})

// ─── editBooking ──────────────────────────────────────────────────────────────

describe('editBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx({ identity: null })
    await expect(edit.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'UNAUTHENTICATED' },
    })
  })

  it('throws INVALID_STATUS when booking is Draft', async () => {
    const ctx = makeCtx({
      booking: { _id: 'booking-1', ownerId: 'owner-slug', status: 'Draft' },
    })
    await expect(edit.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'INVALID_STATUS' },
    })
  })

  it('throws INVALID_STATUS when booking is Cancelled', async () => {
    const ctx = makeCtx({
      booking: { _id: 'booking-1', ownerId: 'owner-slug', status: 'Cancelled' },
    })
    await expect(edit.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'INVALID_STATUS' },
    })
  })

  it('resets Upcoming booking to Draft and clears sessions', async () => {
    const session = { _id: 'session-1' }
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Upcoming' }
    const ctx = makeCtx({ booking, reservations: [], sessions: [session] })
    await edit.handler(ctx, { bookingId: 'booking-1' })

    expect(ctx.db.delete).toHaveBeenCalledWith('session-1')
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', {
      status: 'Draft',
      bookingFormComplete: false,
      submittedAt: undefined,
      expiresAt: undefined,
    })
  })

  it('resets Completed booking to Draft', async () => {
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Completed' }
    const ctx = makeCtx({ booking, reservations: [], sessions: [] })
    await edit.handler(ctx, { bookingId: 'booking-1' })
    expect(ctx.db.patch).toHaveBeenCalledWith('booking-1', expect.objectContaining({
      status: 'Draft',
      bookingFormComplete: false,
    }))
  })

  it('vacates Confirmed reservations with reason operator_edit', async () => {
    const reservation = {
      _id: 'res-1',
      status: 'Confirmed',
      bookingSessionId: 'session-1',
      inventoryUnitId: 'unit-1',
      unitsRequested: 2,
    }
    const booking = { _id: 'booking-1', ownerId: 'owner-slug', status: 'Upcoming' }
    const ctx = makeCtx({ booking, reservations: [reservation], sessions: [] })
    await edit.handler(ctx, { bookingId: 'booking-1' })

    expect(ctx.db.patch).toHaveBeenCalledWith('res-1', expect.objectContaining({
      status: 'Vacated',
      vacatedBy: 'operator_edit',
    }))
  })

  it('throws FORBIDDEN when caller does not own the booking', async () => {
    const ctx = makeCtx({
      user: { _id: 'user-1', slug: 'other-slug' },
      booking: { _id: 'booking-1', ownerId: 'owner-slug', status: 'Upcoming' },
    })
    await expect(edit.handler(ctx, { bookingId: 'booking-1' })).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' },
    })
  })
})

// Ensure ConvexError is imported so instanceof checks are available in this module
void ConvexError
