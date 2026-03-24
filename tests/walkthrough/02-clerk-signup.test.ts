import { describe, it, expect, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createUser (post sign-up)', () => {
  it('creates a user record with the selected role', async () => {
    const t = makeT()

    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-01' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'Test DC' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('DiveCenter')
    expect(user?.businessName).toBe('Test DC')
    expect(user?.tokenIdentifier).toBe('clerk|signup-dc-01')
  })

  it('is idempotent — returns same ID on second call', async () => {
    const t = makeT()

    vi.useFakeTimers({ now: Date.now() })
    const id1 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'First Call' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const id2 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02' })
      .mutation(api.users.createUser, { role: 'Instructor', businessName: 'Second Call' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(id1).toBe(id2)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('new user has onboardingComplete undefined', async () => {
    const t = makeT()

    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-03' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'Fresh DC' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.onboardingComplete).toBeUndefined()
  })
})
