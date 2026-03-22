import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

const modules = import.meta.glob('../../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'DiveCenter' as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('setRole', () => {
  it('sets users.role to DiveCenter', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => seedUser(ctx, 'role-dc-01'))

    await t.withIdentity({ tokenIdentifier: 'clerk|role-dc-01' })
      .mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'Test DC' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('DiveCenter')
    expect(user?.businessName).toBe('Test DC')
  })

  it('sets users.role to Instructor', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => seedUser(ctx, 'role-inst-01'))

    await t.withIdentity({ tokenIdentifier: 'clerk|role-inst-01' })
      .mutation(api.users.setRole, { role: 'Instructor', businessName: '' })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('Instructor')
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when user record does not exist', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|nonexistent-user' })
        .mutation(api.users.setRole, { role: 'DiveCenter', businessName: 'X' }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })
})
