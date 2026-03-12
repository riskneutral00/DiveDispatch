import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
}))

import { isSessionEnded, expireHolds, completeBookings } from '../convex/bookingsMutations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalMutationConfig = { args: unknown; handler: (ctx: any, args: any) => Promise<unknown> }

const expireHoldsMutation = expireHolds as unknown as InternalMutationConfig
const completeBookingsMutation = completeBookings as unknown as InternalMutationConfig

// ─── isSessionEnded ────────────────────────────────────────────────────────────

describe('isSessionEnded', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns true when current date is past the session date', () => {
    // Mock: 2024-06-16 10:00 UTC → Bangkok (UTC+7) 2024-06-16 17:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-16T10:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '17:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exceeds session end time on the same day', () => {
    // Mock: 2024-06-15 12:00 UTC → Bangkok 2024-06-15 19:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns true when current time exactly equals session end time', () => {
    // Mock: 2024-06-15 11:00 UTC → Bangkok 2024-06-15 18:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T11:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(true)
  })

  it('returns false when session has not ended yet', () => {
    // Mock: 2024-06-15 09:00 UTC → Bangkok 2024-06-15 16:00; session ends 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T09:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'Asia/Bangkok')).toBe(false)
  })

  it('returns false when current date is before session date', () => {
    // Mock: 2024-06-14 10:00 UTC → Bangkok 2024-06-14 17:00; session is 2024-06-15
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-14T10:00:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '08:00', 'Asia/Bangkok')).toBe(false)
  })

  it('works with UTC timezone', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T18:01:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '18:00', 'UTC')).toBe(true)
  })

  it('handles midnight boundary (session ending at 00:00 next day)', () => {
    // 2024-06-15T17:01:00Z → Bangkok 2024-06-16 00:01; session 2024-06-15 ending 23:59
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T17:01:00Z').getTime())
    expect(isSessionEnded('2024-06-15', '23:59', 'Asia/Bangkok')).toBe(true)
  })
})

// ─── expireHolds ───────────────────────────────────────────────────────────────

describe('expireHolds', () => {
  afterEach(() => vi.clearAllMocks())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeCtx(drafts: any[] = []) {
    return {
      db: {
        get: vi.fn(async () => null),
        patch: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => {
              if (table === 'bookings') return drafts
              return [] // reservations, bookingSessions, bookingLinks
            }),
            unique: vi.fn(async () => null),
          })),
        })),
      },
    }
  }

  it('returns { expired: 0, more: false } when no bookings have expired', async () => {
    const future = Date.now() + 10_000
    const ctx = makeCtx([
      { _id: 'b-1', status: 'Draft', expiresAt: future },
    ])
    const result = await expireHoldsMutation.handler(ctx, {})
    expect(result).toEqual({ expired: 0, more: false })
    expect(ctx.db.delete).not.toHaveBeenCalled()
  })

  it('deletes a booking whose expiresAt is in the past', async () => {
    const past = Date.now() - 1_000
    const ctx = makeCtx([
      { _id: 'b-1', status: 'Draft', expiresAt: past },
    ])
    const result = await expireHoldsMutation.handler(ctx, {})
    expect(result).toEqual({ expired: 1, more: false })
    expect(ctx.db.delete).toHaveBeenCalledWith('b-1')
  })

  it('skips bookings with no expiresAt', async () => {
    const ctx = makeCtx([
      { _id: 'b-1', status: 'Draft', expiresAt: undefined },
    ])
    const result = await expireHoldsMutation.handler(ctx, {})
    expect(result).toEqual({ expired: 0, more: false })
    expect(ctx.db.delete).not.toHaveBeenCalled()
  })

  it('reports more: true when there are >100 expired bookings', async () => {
    const past = Date.now() - 1_000
    const manyExpired = Array.from({ length: 101 }, (_, i) => ({
      _id: `b-${i}`,
      status: 'Draft',
      expiresAt: past,
    }))
    const ctx = makeCtx(manyExpired)
    const result = (await expireHoldsMutation.handler(ctx, {})) as { expired: number; more: boolean }
    expect(result.expired).toBe(100)
    expect(result.more).toBe(true)
  })

  it('expires multiple bookings in the same run', async () => {
    const past = Date.now() - 1_000
    const ctx = makeCtx([
      { _id: 'b-1', status: 'Draft', expiresAt: past },
      { _id: 'b-2', status: 'Draft', expiresAt: past },
    ])
    const result = await expireHoldsMutation.handler(ctx, {})
    expect(result).toEqual({ expired: 2, more: false })
    expect(ctx.db.delete).toHaveBeenCalledWith('b-1')
    expect(ctx.db.delete).toHaveBeenCalledWith('b-2')
  })
})

// ─── completeBookings ──────────────────────────────────────────────────────────

describe('completeBookings', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeCtx(bookings: any[] = [], sessions: any[] = []) {
    return {
      db: {
        get: vi.fn(async () => null),
        patch: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => {
              if (table === 'bookings') return bookings
              if (table === 'bookingSessions') return sessions
              return []
            }),
            unique: vi.fn(async () => null),
          })),
        })),
      },
    }
  }

  it('returns { completed: 0, more: false } when no sessions have ended', async () => {
    // Session in the future
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T08:00:00Z').getTime())
    const ctx = makeCtx(
      [{ _id: 'b-1', status: 'Upcoming' }],
      [{ _id: 's-1', date: '2024-06-15', endTime: '17:00', timezone: 'Asia/Bangkok' }],
    )
    const result = await completeBookingsMutation.handler(ctx, {})
    expect(result).toEqual({ completed: 0, more: false })
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it('completes a booking when its last session has ended', async () => {
    // 2024-06-15 12:00 UTC → Bangkok 19:00; session ended at 18:00
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())
    const ctx = makeCtx(
      [{ _id: 'b-1', status: 'Upcoming' }],
      [{ _id: 's-1', date: '2024-06-15', endTime: '18:00', timezone: 'Asia/Bangkok' }],
    )
    const result = await completeBookingsMutation.handler(ctx, {})
    expect(result).toEqual({ completed: 1, more: false })
    expect(ctx.db.patch).toHaveBeenCalledWith('b-1', { status: 'Completed' })
  })

  it('picks the last session by date and endTime for multi-session bookings', async () => {
    // b-1 has two sessions; last one ends at 18:00 today
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())
    const ctx = makeCtx(
      [{ _id: 'b-1', status: 'Upcoming' }],
      [
        { _id: 's-1', date: '2024-06-14', endTime: '17:00', timezone: 'Asia/Bangkok' },
        { _id: 's-2', date: '2024-06-15', endTime: '18:00', timezone: 'Asia/Bangkok' },
      ],
    )
    const result = await completeBookingsMutation.handler(ctx, {})
    expect(result).toEqual({ completed: 1, more: false })
  })

  it('skips bookings with no sessions', async () => {
    const ctx = makeCtx([{ _id: 'b-1', status: 'Upcoming' }], [])
    const result = await completeBookingsMutation.handler(ctx, {})
    expect(result).toEqual({ completed: 0, more: false })
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it('reports more: true when there are >100 Upcoming bookings', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-15T12:00:00Z').getTime())
    const manyBookings = Array.from({ length: 101 }, (_, i) => ({
      _id: `b-${i}`,
      status: 'Upcoming',
    }))
    // All bookings share the same sessions list — each one has ended
    const ctx = makeCtx(
      manyBookings,
      [{ _id: 's-1', date: '2024-06-15', endTime: '10:00', timezone: 'Asia/Bangkok' }],
    )
    const result = (await completeBookingsMutation.handler(ctx, {})) as {
      completed: number
      more: boolean
    }
    expect(result.more).toBe(true)
  })
})
