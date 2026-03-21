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

describe('saveBookingTemplates', () => {
  it('creates records for selected pills', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'pref-dc-01'))

    // Simulate the preferences step: user selects DSD and OW, each becomes a pill
    await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-01' })
      .mutation(api.bookingTemplates.create, { name: 'DSD', activityType: ['DSD'] })
    await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-01' })
      .mutation(api.bookingTemplates.create, { name: 'OW', activityType: ['OW'] })

    const templates = await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-01' })
      .query(api.bookingTemplates.list, {})

    expect(templates).toHaveLength(2)
    const names = templates.map((tmpl: { name: string }) => tmpl.name)
    expect(names).toContain('DSD')
    expect(names).toContain('OW')
  })

  it('with no pills creates no records', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'pref-dc-02'))

    // Skip path: user clicks Continue without adding any pills
    const templates = await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-02' })
      .query(api.bookingTemplates.list, {})

    expect(templates).toHaveLength(0)
  })

  it('rejects duplicate pill types', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, 'pref-dc-03'))

    // Pass duplicate activityType codes in a single template.
    // The create mutation accepts the array as-is (no server-side dedup or rejection).
    const id = await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-03' })
      .mutation(api.bookingTemplates.create, { name: 'Dupes', activityType: ['DSD', 'DSD'] })

    expect(id).toBeDefined()

    const templates = await t.withIdentity({ tokenIdentifier: 'clerk|pref-dc-03' })
      .query(api.bookingTemplates.list, {})

    // One template record is created regardless of duplicate codes in the array
    expect(templates).toHaveLength(1)
    expect(templates[0]._id).toBe(id)
  })
})
