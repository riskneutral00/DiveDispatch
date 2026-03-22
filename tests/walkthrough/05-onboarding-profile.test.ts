import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

const modules = import.meta.glob('../../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

async function seedUser(ctx: AnyCtx, slug: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} DC`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    role: 'DiveCenter',
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// ─── Tests: diveCenters.create (onboarding profile step save) ─────────────────

describe('05: onboarding profile step — save mutation', () => {
  it('save mutation persists associations array', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-assoc'))

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-assoc' })
      .mutation(api.diveCenters.create, {
        name: 'Assoc Test DC',
        city: 'Phuket',
        country: 'Thailand',
        contactEmail: 'assoc@test.com',
        contactPhone: '+66891234567',
        associations: [{ agency: 'PADI', number: 'TH-00123' }],
        focusedLanguages: ['en'],
      })

    const profile = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-assoc' })
      .query(api.diveCenters.mine, {})

    expect(profile).not.toBeNull()
    expect(profile!.associations).toHaveLength(1)
    expect(profile!.associations[0]).toMatchObject({ agency: 'PADI', number: 'TH-00123' })
  })

  it('save mutation persists languages', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-langs'))

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-langs' })
      .mutation(api.diveCenters.create, {
        name: 'Languages Test DC',
        city: 'Koh Tao',
        country: 'Thailand',
        contactEmail: 'langs@test.com',
        contactPhone: '+66891234568',
        associations: [],
        focusedLanguages: ['en', 'th'],
      })

    const profile = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-langs' })
      .query(api.diveCenters.mine, {})

    expect(profile).not.toBeNull()
    expect(profile!.focusedLanguages).toContain('en')
    expect(profile!.focusedLanguages).toContain('th')
  })

  it('save mutation persists OW/AOW day defaults', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'dc-days'))

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-days' })
      .mutation(api.diveCenters.create, {
        name: 'Days Test DC',
        city: 'Phuket',
        country: 'Thailand',
        contactEmail: 'days@test.com',
        contactPhone: '+66891234569',
        associations: [],
        focusedLanguages: ['en'],
        bookingPreferences: { owDays: 4, aowDays: 2 },
      })

    const profile = await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-days' })
      .query(api.diveCenters.mine, {})

    expect(profile).not.toBeNull()
    expect(profile!.bookingPreferences?.owDays).toBe(4)
    expect(profile!.bookingPreferences?.aowDays).toBe(2)
  })
})
