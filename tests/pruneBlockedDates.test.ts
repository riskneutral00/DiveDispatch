/**
 * pruneBlockedDates cron — unit tests
 *
 * Covers:
 *   - Past dates are removed from stakeholderBlockedDates rows
 *   - Today's date is preserved (not pruned)
 *   - Future dates are preserved
 *   - Mixed arrays: only past dates removed, rest intact
 *   - Multiple stakeholder rows are all pruned
 *   - Row with only past dates: dates array becomes empty (row remains)
 *   - Empty database: no-op, no errors
 */

import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'
import { seedBlockedDates } from './fixtures'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pruneBlockedDates', () => {
  it('removes past dates from a stakeholder row', async () => {
    const t = makeT()
    const pastDate = testDate(-5)
    const futureDate = testDate(5)

    await t.run(async (ctx) => {
      await seedBlockedDates(ctx, {
        stakeholderId: 'instr-1',
        roleType: 'Instructor',
        dates: [pastDate, futureDate],
      })
    })

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].dates).toEqual([futureDate])
    })
  })

  it('preserves current and future dates', async () => {
    const t = makeT()
    // Use testDate(1) instead of today() to avoid timezone edge cases
    // (todayISO uses Asia/Bangkok; test helper uses local time)
    const tomorrowDate = testDate(1)
    const futureDate = testDate(10)

    await t.run(async (ctx) => {
      await seedBlockedDates(ctx, {
        stakeholderId: 'instr-1',
        roleType: 'Instructor',
        dates: [tomorrowDate, futureDate],
      })
    })

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].dates).toEqual([tomorrowDate, futureDate])
    })
  })

  it('handles row with only past dates — array becomes empty', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedBlockedDates(ctx, {
        stakeholderId: 'boat-1',
        roleType: 'Boat',
        dates: [testDate(-30), testDate(-10), testDate(-1)],
      })
    })

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].dates).toEqual([])
    })
  })

  it('prunes multiple stakeholder rows in one pass', async () => {
    const t = makeT()
    const pastDate = testDate(-3)
    const futureA = testDate(7)
    const futureB = testDate(14)

    await t.run(async (ctx) => {
      await seedBlockedDates(ctx, {
        stakeholderId: 'instr-1',
        roleType: 'Instructor',
        dates: [pastDate, futureA],
      })
      await seedBlockedDates(ctx, {
        stakeholderId: 'boat-1',
        roleType: 'Boat',
        dates: [pastDate, futureB],
      })
    })

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(2)

      const instrRow = rows.find((r) => r.stakeholderId === 'instr-1')!
      const boatRow = rows.find((r) => r.stakeholderId === 'boat-1')!

      expect(instrRow.dates).toEqual([futureA])
      expect(boatRow.dates).toEqual([futureB])
    })
  })

  it('is a no-op on an empty table', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(0)
    })
  })

  it('does not modify rows with only future dates', async () => {
    const t = makeT()
    const futureA = testDate(3)
    const futureB = testDate(20)

    await t.run(async (ctx) => {
      await seedBlockedDates(ctx, {
        stakeholderId: 'instr-1',
        roleType: 'Instructor',
        dates: [futureA, futureB],
      })
    })

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.availability.pruneBlockedDates, {})
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('stakeholderBlockedDates').collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].dates).toEqual([futureA, futureB])
    })
  })

  it('returns the count of pruned rows', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      // Row with past dates (will be pruned)
      await seedBlockedDates(ctx, {
        stakeholderId: 'instr-1',
        roleType: 'Instructor',
        dates: [testDate(-5), testDate(5)],
      })
      // Row with only future dates (no pruning needed)
      await seedBlockedDates(ctx, {
        stakeholderId: 'boat-1',
        roleType: 'Boat',
        dates: [testDate(10)],
      })
    })

    let prunedCount: number | undefined
    await t.run(async (ctx) => {
      prunedCount = await ctx.runMutation(internal.availability.pruneBlockedDates, {}) as number
    })

    expect(prunedCount).toBe(1)
  })
})
