/**
 * @module-tag slow
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import { createUserDefaults } from '../helpers/createUser'


describe('createUser (post sign-up)', () => {
  it('creates a user record with the selected role', async () => {
    const t = makeT()

    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-01', email: 'signup-1@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'DiveCenter' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.tokenIdentifier).toBe('clerk|signup-dc-01')
  })

  it('is idempotent — returns same ID on second call', async () => {
    const t = makeT()

    vi.useFakeTimers({ now: Date.now() })
    const id1 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02', email: 'signup-2@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'DiveCenter' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const id2 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02', email: 'signup-2@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'Instructor' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(id1).toBe(id2)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.users.createUser, { ...createUserDefaults, role: 'DiveCenter' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

})
