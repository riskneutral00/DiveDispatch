import { describe, it, expect, vi } from 'vitest'
import { ConvexError } from 'convex/values'

vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
}))

import {
  _getOpenRequestsHandler,
  _getConfirmedScheduleHandler,
} from '../convex/resourceQueries'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CALLER = {
  _id: 'u1',
  slug: 'instructor-slug',
  tokenIdentifier: 'user|123',
  role: 'Instructor',
}

const UNIT = {
  _id: 'unit1',
  ownerId: 'instructor-slug',
  ownerType: 'Instructor',
  resourceType: 'Instructor',
  displayName: 'John Doe',
  capacityModel: 'Exclusive',
  totalUnits: 1,
}

const BOOKING = {
  _id: 'booking1',
  ownerId: 'dc-slug',
  operatorName: 'Phuket Dive Center',
  activityType: ['OW'],
  startDate: '2024-06-01',
  endDate: '2024-06-03',
  divers: [
    {
      name: 'Alice',
      abbrev: 'AL',
      flag: { code: 'US', label: 'USA' },
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      activityType: ['OW'],
    },
    {
      name: 'Bob',
      abbrev: 'BO',
      flag: { code: 'UK', label: 'United Kingdom' },
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      activityType: ['OW'],
    },
  ],
  status: 'Draft',
}

const SESSION_A = {
  _id: 'session1',
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  date: '2024-06-02',
  startTime: '08:00',
  endTime: '16:00',
  timezone: 'Asia/Bangkok',
}

const SESSION_B = {
  _id: 'session2',
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  date: '2024-06-01',
  startTime: '09:00',
  endTime: '12:00',
  timezone: 'Asia/Bangkok',
}

const PENDING_RESERVATION = {
  _id: 'res1',
  _creationTime: 1000,
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  bookingSessionId: 'session1',
  unitsRequested: 1,
  status: 'PendingAcceptance',
}

const CONFIRMED_RESERVATION = {
  _id: 'res2',
  _creationTime: 2000,
  bookingId: 'booking1',
  inventoryUnitId: 'unit1',
  bookingSessionId: 'session1',
  unitsRequested: 1,
  status: 'Confirmed',
  confirmedAt: 999,
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeCtx({
  identity = { tokenIdentifier: 'user|123' } as unknown,
  caller = CALLER as unknown,
  units = [UNIT] as unknown[],
  reservations = [] as unknown[],
  sessions = [] as unknown[],
  docsById = {} as Record<string, unknown>,
} = {}) {
  const defaultDocs: Record<string, unknown> = {
    booking1: BOOKING,
    session1: SESSION_A,
    session2: SESSION_B,
    ...docsById,
  }

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockImplementation((id: string) => Promise.resolve(defaultDocs[id] ?? null)),
      query: vi.fn().mockImplementation((table: string) => {
        let collectResult: unknown[] = []
        let uniqueResult: unknown = null

        if (table === 'users') {
          uniqueResult = caller
        } else if (table === 'inventoryUnits') {
          collectResult = units
        } else if (table === 'reservations') {
          collectResult = reservations
        } else if (table === 'bookingSessions') {
          collectResult = sessions
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

// ─── getOpenRequests ──────────────────────────────────────────────────────────

describe('getOpenRequests', () => {
  it('returns PendingAcceptance reservations with booking context', async () => {
    const ctx = makeCtx({ reservations: [PENDING_RESERVATION] })

    const result = await _getOpenRequestsHandler(ctx)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      reservationId: 'res1',
      inventoryUnitId: 'unit1',
      bookingId: 'booking1',
      unitsRequested: 1,
      createdAt: 1000,
      activityType: ['OW'],
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      diverCount: 2,
      operatorName: 'Phuket Dive Center',
    })
  })

  it('returns empty array when no pending reservations exist', async () => {
    const ctx = makeCtx({ reservations: [] })

    const result = await _getOpenRequestsHandler(ctx)

    expect(result).toEqual([])
  })

  it('returns empty array when caller owns no inventory units', async () => {
    const ctx = makeCtx({ units: [], reservations: [PENDING_RESERVATION] })

    const result = await _getOpenRequestsHandler(ctx)

    expect(result).toEqual([])
  })

  it('sorts by createdAt descending', async () => {
    // Single unit, two reservations with different timestamps
    const OLDER = { ...PENDING_RESERVATION, _id: 'res_old', _creationTime: 500 }
    const NEWER = { ...PENDING_RESERVATION, _id: 'res_new', _creationTime: 1500 }

    const ctx = makeCtx({ reservations: [OLDER, NEWER] })

    const result = await _getOpenRequestsHandler(ctx)

    expect(result).toHaveLength(2)
    expect(result[0].createdAt).toBeGreaterThan(result[1].createdAt)
    expect(result[0].reservationId).toBe('res_new')
    expect(result[1].reservationId).toBe('res_old')
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(_getOpenRequestsHandler(ctx)).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const ctx = makeCtx({ caller: null })

    await expect(_getOpenRequestsHandler(ctx)).rejects.toSatisfy((err) => {
      expectConvexError(err, 'NOT_FOUND')
      return true
    })
  })

  it('skips reservation when booking record is missing', async () => {
    const ctx = makeCtx({
      reservations: [PENDING_RESERVATION],
      docsById: { booking1: null },
    })

    const result = await _getOpenRequestsHandler(ctx)

    expect(result).toEqual([])
  })
})

// ─── getConfirmedSchedule ─────────────────────────────────────────────────────

describe('getConfirmedSchedule', () => {
  it('returns Confirmed reservations with booking context and sessions', async () => {
    const ctx = makeCtx({
      reservations: [CONFIRMED_RESERVATION],
      sessions: [SESSION_A, SESSION_B],
    })

    const result = await _getConfirmedScheduleHandler(ctx)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      reservationId: 'res2',
      inventoryUnitId: 'unit1',
      bookingId: 'booking1',
      unitsRequested: 1,
      confirmedAt: 999,
      activityType: ['OW'],
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      diverCount: 2,
      operatorName: 'Phuket Dive Center',
    })
    expect(result[0].sessions).toHaveLength(2)
  })

  it('sorts sessions by date ascending within a booking', async () => {
    const ctx = makeCtx({
      reservations: [CONFIRMED_RESERVATION],
      sessions: [SESSION_A, SESSION_B], // SESSION_A is 06-02, SESSION_B is 06-01
    })

    const result = await _getConfirmedScheduleHandler(ctx)

    const dates = result[0].sessions.map((s) => s.date)
    expect(dates).toEqual(['2024-06-01', '2024-06-02'])
  })

  it('filters sessions to only those belonging to this inventory unit', async () => {
    const OTHER_UNIT_SESSION = {
      _id: 'session3',
      bookingId: 'booking1',
      inventoryUnitId: 'unit_other',
      date: '2024-06-03',
      startTime: '10:00',
      endTime: '14:00',
      timezone: 'Asia/Bangkok',
    }
    const ctx = makeCtx({
      reservations: [CONFIRMED_RESERVATION],
      sessions: [SESSION_A, OTHER_UNIT_SESSION],
    })

    const result = await _getConfirmedScheduleHandler(ctx)

    expect(result[0].sessions).toHaveLength(1)
    expect(result[0].sessions[0].sessionId).toBe('session1')
  })

  it('sorts results by earliest session date ascending', async () => {
    // Two confirmed reservations for different bookings under the same unit.
    // Use empty sessions so sorting falls back to booking.startDate — avoids
    // mock cross-contamination when two reservations share the sessions array.
    const BOOKING_2 = { ...BOOKING, _id: 'booking2', startDate: '2024-05-01', endDate: '2024-05-02' }
    const RESERVATION_2 = {
      ...CONFIRMED_RESERVATION,
      _id: 'res3',
      bookingId: 'booking2',
      inventoryUnitId: 'unit1',
    }

    const ctx = makeCtx({
      reservations: [CONFIRMED_RESERVATION, RESERVATION_2],
      sessions: [],
      docsById: { booking1: BOOKING, booking2: BOOKING_2 },
    })

    const result = await _getConfirmedScheduleHandler(ctx)

    // booking2 (startDate 2024-05-01) should sort before booking1 (2024-06-01)
    expect(result[0].bookingId).toBe('booking2')
    expect(result[1].bookingId).toBe('booking1')
  })

  it('returns empty array when no confirmed reservations exist', async () => {
    const ctx = makeCtx({ reservations: [] })

    const result = await _getConfirmedScheduleHandler(ctx)

    expect(result).toEqual([])
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(_getConfirmedScheduleHandler(ctx)).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })

  it('throws NOT_FOUND when caller user record does not exist', async () => {
    const ctx = makeCtx({ caller: null })

    await expect(_getConfirmedScheduleHandler(ctx)).rejects.toSatisfy((err) => {
      expectConvexError(err, 'NOT_FOUND')
      return true
    })
  })

  it('skips reservation when booking record is missing', async () => {
    const ctx = makeCtx({
      reservations: [CONFIRMED_RESERVATION],
      sessions: [SESSION_A],
      docsById: { booking1: null },
    })

    const result = await _getConfirmedScheduleHandler(ctx)

    expect(result).toEqual([])
  })
})
