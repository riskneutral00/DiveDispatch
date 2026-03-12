import { describe, it, expect, vi } from 'vitest'
import { ConvexError } from 'convex/values'

// Vitest mock for the Convex generated server module (not present in worktree)
vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
}))

import {
  _acceptHandler,
  _declineHandler,
  getDateRange,
} from '../convex/reservationsMutations'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER = {
  _id: 'u1',
  slug: 'instructor-slug',
  tokenIdentifier: 'user|123',
  role: 'Instructor',
}

const OTHER_USER = {
  _id: 'u2',
  slug: 'other-slug',
  tokenIdentifier: 'user|456',
  role: 'Instructor',
}

const UNIT = {
  _id: 'unit1',
  ownerId: 'instructor-slug',
  resourceType: 'Instructor',
  ownerType: 'Instructor',
  capacityModel: 'Exclusive',
  totalUnits: 1,
  displayName: 'John Doe',
}

const BOOKING = {
  _id: 'booking1',
  ownerId: 'dc-slug',
  status: 'Draft',
  startDate: '2024-06-01',
  endDate: '2024-06-01',
  bookingFormComplete: true,
  customerFormComplete: true,
  medicalHardBlock: false,
  instructorId: 'instructor-slug',
}

const SESSION = {
  _id: 'session1',
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  date: '2024-06-01',
  startTime: '08:00',
  endTime: '16:00',
  timezone: 'Asia/Bangkok',
}

const SNAPSHOT = {
  _id: 'snap1',
  inventoryUnitId: 'unit1',
  date: '2024-06-01',
  windowStart: '08:00',
  windowEnd: '16:00',
  totalUnits: 1,
  availableUnits: 0,
  reservedUnits: 1,
}

const PENDING_RESERVATION = {
  _id: 'res1',
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  bookingSessionId: 'session1',
  unitsRequested: 1,
  status: 'PendingAcceptance',
}

const CONFIRMED_RESERVATION = { ...PENDING_RESERVATION, status: 'Confirmed' }

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeCtx({
  identity = { tokenIdentifier: 'user|123' } as unknown,
  userByToken = USER as unknown,
  docsById = {} as Record<string, unknown>,
  reservations = [] as unknown[],
  inventoryUnits = [] as unknown[],
  snapshots = [] as unknown[],
} = {}) {
  const defaultDocs: Record<string, unknown> = {
    u1: USER,
    unit1: UNIT,
    booking1: BOOKING,
    session1: SESSION,
    snap1: SNAPSHOT,
    res1: PENDING_RESERVATION,
    ...docsById,
  }

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockImplementation((id: string) => Promise.resolve(defaultDocs[id] ?? null)),
      patch: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockResolvedValue('new-id'),
      delete: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation((table: string) => {
        let collectResult: unknown[] = []
        let uniqueResult: unknown = null

        if (table === 'users') {
          uniqueResult = userByToken
          collectResult = userByToken ? [userByToken] : []
        } else if (table === 'reservations') {
          collectResult = reservations
          uniqueResult = reservations[0] ?? null
        } else if (table === 'inventoryUnits') {
          collectResult = inventoryUnits
          uniqueResult = inventoryUnits[0] ?? null
        } else if (table === 'availabilitySnapshots') {
          collectResult = snapshots
          uniqueResult = snapshots[0] ?? null
        }

        const chain = {
          withIndex: vi.fn(),
          collect: vi.fn().mockResolvedValue(collectResult),
          unique: vi.fn().mockResolvedValue(uniqueResult),
          first: vi.fn().mockResolvedValue(collectResult[0] ?? null),
        }
        chain.withIndex.mockReturnValue(chain)
        return chain
      }),
    },
  }
}

function expectConvexError(err: unknown, code: string) {
  expect(err).toBeInstanceOf(ConvexError)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((err as ConvexError<any>).data).toMatchObject({ code })
}

// ─── getDateRange ─────────────────────────────────────────────────────────────

describe('getDateRange', () => {
  it('returns single date when start equals end', () => {
    expect(getDateRange('2024-06-01', '2024-06-01')).toEqual(['2024-06-01'])
  })

  it('returns inclusive range across multiple days', () => {
    expect(getDateRange('2024-06-01', '2024-06-03')).toEqual([
      '2024-06-01',
      '2024-06-02',
      '2024-06-03',
    ])
  })
})

// ─── acceptReservation ────────────────────────────────────────────────────────

describe('acceptReservation', () => {
  it('transitions PendingAcceptance to Confirmed and sets confirmedAt', async () => {
    const ctx = makeCtx({ reservations: [PENDING_RESERVATION] })

    await _acceptHandler(ctx, { reservationId: 'res1' })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      'res1',
      expect.objectContaining({
        status: 'Confirmed',
        confirmedAt: expect.any(Number),
      }),
    )
  })

  it('is idempotent: double-accept does not re-patch the reservation', async () => {
    const ctx = makeCtx({
      docsById: { res1: CONFIRMED_RESERVATION },
      reservations: [CONFIRMED_RESERVATION],
    })

    await _acceptHandler(ctx, { reservationId: 'res1' })

    // Early return — patch should not be called for the reservation
    expect(ctx.db.patch).not.toHaveBeenCalledWith('res1', expect.anything())
  })

  it('throws FORBIDDEN when caller does not own the inventory unit', async () => {
    const ctx = makeCtx({
      userByToken: OTHER_USER,
      reservations: [PENDING_RESERVATION],
    })

    await expect(_acceptHandler(ctx, { reservationId: 'res1' })).rejects.toSatisfy((err) => {
      expectConvexError(err, 'FORBIDDEN')
      return true
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(_acceptHandler(ctx, { reservationId: 'res1' })).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })
})

// ─── declineReservation ───────────────────────────────────────────────────────

describe('declineReservation', () => {
  it('vacates the reservation with stakeholder_declined and restores the snapshot', async () => {
    const ctx = makeCtx({
      reservations: [PENDING_RESERVATION],
      snapshots: [SNAPSHOT],
    })

    await _declineHandler(ctx, { bookingId: 'booking1', inventoryUnitId: 'unit1' })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      'res1',
      expect.objectContaining({
        status: 'Vacated',
        vacatedBy: 'stakeholder_declined',
        vacatedAt: expect.any(Number),
      }),
    )

    // unitsRequested=1 returned to snapshot (0 → 1 available, 1 → 0 reserved)
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'snap1',
      expect.objectContaining({
        availableUnits: 1,
        reservedUnits: 0,
      }),
    )
  })

  it('sends hold_declined notification to the booking owner', async () => {
    const ctx = makeCtx({ reservations: [PENDING_RESERVATION] })

    await _declineHandler(ctx, { bookingId: 'booking1', inventoryUnitId: 'unit1' })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        userId: 'dc-slug',
        type: 'hold_declined',
        bookingId: 'booking1',
      }),
    )
  })

  it('sends no_backup_available when no alternative units exist', async () => {
    // inventoryUnits defaults to [] — no candidates
    const ctx = makeCtx({ reservations: [PENDING_RESERVATION] })

    await _declineHandler(ctx, { bookingId: 'booking1', inventoryUnitId: 'unit1' })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        type: 'no_backup_available',
        userId: 'dc-slug',
      }),
    )
  })

  it('throws FORBIDDEN when caller does not own the inventory unit', async () => {
    const ctx = makeCtx({ userByToken: OTHER_USER })

    await expect(
      _declineHandler(ctx, { bookingId: 'booking1', inventoryUnitId: 'unit1' }),
    ).rejects.toSatisfy((err) => {
      expectConvexError(err, 'FORBIDDEN')
      return true
    })
  })
})
