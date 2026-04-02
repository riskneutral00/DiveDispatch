/**
 * DD-363: post-trip portal state — getByToken returns 'post_trip'
 * when booking is Completed or endDate has passed.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedPortalFixture, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'
import { testDate } from './helpers/dates'

describe('getByToken — post_trip detection', () => {
  it('returns post_trip for a Completed booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Completed', startDate: testDate(-7), endDate: testDate(-2) },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('post_trip')
  })

  it('returns post_trip for an Upcoming booking whose endDate is in the past', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', startDate: testDate(-5), endDate: testDate(-1) },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('post_trip')
  })

  it('does not return post_trip for an active Upcoming booking (end in future)', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Upcoming', startDate: testDate(1), endDate: testDate(3) },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('closed')
  })

  it('does not return post_trip for a Cancelled booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Cancelled', startDate: testDate(-5), endDate: testDate(-1) },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('closed')
  })

  it('post_trip result includes operatorName, startDate, and endDate', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          status: 'Completed',
          startDate: testDate(-7),
          endDate: testDate(-2),
          operatorName: 'Blue Ocean Dive Center',
        },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('post_trip')
    if (result.status !== 'post_trip') return
    expect(result.operatorName).toBe('Blue Ocean Dive Center')
    expect(result.startDate).toBe(testDate(-7))
    expect(result.endDate).toBe(testDate(-2))
  })

  it('still returns completed (token used) even when booking is Completed', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { status: 'Completed', startDate: testDate(-7), endDate: testDate(-2) },
        link: { usedAt: Date.now() - 5000 },
      }),
    )
    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
  })
})
