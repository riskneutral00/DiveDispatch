import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

const modules = import.meta.glob('../../convex/**/*.ts')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createUser (post sign-up)', () => {
  it('creates a user record with the selected role', async () => {
    const t = convexTest(schema, modules)

    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-01' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'Test DC' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('DiveCenter')
    expect(user?.businessName).toBe('Test DC')
    expect(user?.tokenIdentifier).toBe('clerk|signup-dc-01')
  })

  it('is idempotent — returns same ID on second call', async () => {
    const t = convexTest(schema, modules)

    const id1 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'First Call' })
    const id2 = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-02' })
      .mutation(api.users.createUser, { role: 'Instructor', businessName: 'Second Call' })

    expect(id1).toBe(id2)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('new user has onboardingComplete undefined', async () => {
    const t = convexTest(schema, modules)

    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|signup-dc-03' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'Fresh DC' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.onboardingComplete).toBeUndefined()
  })
})
