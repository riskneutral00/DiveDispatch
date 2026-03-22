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
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'DiveCenter' as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('diveCenters.create (profile setup)', () => {
  it('writes all required fields to diveCenters', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'profile-dc-01'))

    const id = await t.withIdentity({ tokenIdentifier: 'clerk|profile-dc-01' })
      .mutation(api.diveCenters.create, {
        name: "Matt & Miss Mermaid's DC",
        city: 'Phuket',
        country: 'Thailand',
        contactEmail: 'matt@divedispatch.dev',
        contactPhone: '+66812345678',
        associations: [{ agency: 'PADI', number: '12345' }],
        focusedLanguages: ['en'],
      })

    const profile = await t.run(async (ctx) => ctx.db.get(id))
    expect(profile?.name).toBe("Matt & Miss Mermaid's DC")
    expect(profile?.city).toBe('Phuket')
    expect(profile?.country).toBe('Thailand')
    expect(profile?.contactEmail).toBe('matt@divedispatch.dev')
    expect(profile?.contactPhone).toBe('+66812345678')
    expect(profile?.associations).toHaveLength(1)
    expect(profile?.associations[0].agency).toBe('PADI')
  })

  it('is idempotent — returns existing record ID on second call', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'profile-dc-02'))

    const args = {
      name: 'Idempotent DC',
      city: 'Koh Tao',
      country: 'Thailand',
      contactEmail: 'idem@dc.com',
      contactPhone: '+66800000000',
      associations: [] as { agency: string; number: string }[],
      focusedLanguages: ['en'],
    }

    const id1 = await t.withIdentity({ tokenIdentifier: 'clerk|profile-dc-02' })
      .mutation(api.diveCenters.create, args)
    const id2 = await t.withIdentity({ tokenIdentifier: 'clerk|profile-dc-02' })
      .mutation(api.diveCenters.create, { ...args, name: 'Different Name' })

    // Second call returns the existing record ID unchanged
    expect(id1).toBe(id2)
  })

  it('rejects callers who are not DiveCenter role', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: 'clerk|profile-inst-01',
        slug: 'profile-inst-01',
        email: 'inst@test.com',
        name: 'Inst User',
        firstName: 'Inst',
        lastName: 'Test',
        businessName: 'Inst Biz',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'Instructor' as any,
        isSeeded: false,
        preferredLocale: 'en',
      }),
    )

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|profile-inst-01' })
        .mutation(api.diveCenters.create, {
          name: 'Bad Actor',
          city: 'Phuket',
          country: 'Thailand',
          contactEmail: 'bad@test.com',
          contactPhone: '+66800000000',
          associations: [],
          focusedLanguages: [],
        }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })
})
