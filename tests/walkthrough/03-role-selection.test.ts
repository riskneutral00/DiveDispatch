import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { seedUser as _seedUser, type SeedCtx } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(ctx: SeedCtx, slug: string) {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test', businessName: '' })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('setRole', () => {
  it('sets businessName (role no longer written to users table)', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, 'role-dc-01'))

    await t.withIdentity({ tokenIdentifier: 'clerk|role-dc-01' })
      .mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'Test DC' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.businessName).toBe('Test DC')
  })

  it('sets businessName for Instructor role', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, 'role-inst-01'))

    await t.withIdentity({ tokenIdentifier: 'clerk|role-inst-01' })
      .mutation(api.users.setRole, { role: 'Instructor', businessName: 'Instructor Biz' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.businessName).toBe('Instructor Biz')
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user record does not exist', async () => {
    const t = makeT()

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nonexistent-user' })
        .mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })
})
