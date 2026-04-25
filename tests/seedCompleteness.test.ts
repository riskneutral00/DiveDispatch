import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { checkAllRolesCompleteness } from '../convex/lib/profileCompleteness'
import { makeT } from './helpers/convex-helpers'

describe('seed produces 100% completeness for every assigned role', () => {
  it('Rene (sea-fun) — every role pill reads 100%', async () => {
    const t = makeT()

    await t.action(internal.seed.seedAll, {})

    const roleSummary = await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', 'sea-fun'))
        .unique()
      expect(user, 'Rene seed user must exist').toBeTruthy()
      return checkAllRolesCompleteness(ctx, user!._id)
    })

    const failures = roleSummary.roles.filter((r) => r.percentage !== 100)
    expect(
      failures,
      `Sea Fun role pills not at 100%: ${failures
        .map((f) => `${f.role} ${f.percentage}% — missing: ${f.incomplete.join(', ')}`)
        .join(' | ')}`,
    ).toEqual([])

    expect(roleSummary.allComplete).toBe(true)
  })
})
