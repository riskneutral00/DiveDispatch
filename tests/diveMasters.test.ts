import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'DiveMaster' | 'DiveCenter' = 'DiveMaster') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
}

async function seedDiveMasterProfile(
  ctx: SeedCtx,
  userId: Id<'users'>,
  overrides: { teachingLanguages?: string[] } = {},
) {
  return ctx.db.insert('diveStaff', {
    userId,
    role: 'DiveMaster',
    name: 'Test DiveMaster',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    email: 'dm@test.com',
    phone: '+66123456789',
    credential: [{ agency: 'PADI', level: 'Divemaster', agencyID: '77777' }],
    teachingLanguages: overrides.teachingLanguages ?? ['en'],
    verified: true,
  })
}

describe('directory.listByRole — DiveMaster picker gate', () => {
  it('excludes diveMasters with empty teachingLanguages array', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-dm', 'DiveCenter')
      const u1 = await seedUser(ctx, 'dm-empty', 'DiveMaster')
      await seedDiveMasterProfile(ctx, u1, { teachingLanguages: [] })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-dm' })
      .query(api.directory.listByRole, { role: 'DiveMaster' })
    expect(result).toHaveLength(0)
  })

  it('includes diveMasters with at least one teachingLanguage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-dm2', 'DiveCenter')
      const u1 = await seedUser(ctx, 'dm-ok', 'DiveMaster')
      await seedDiveMasterProfile(ctx, u1, { teachingLanguages: ['th'] })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|caller-dm2' })
      .query(api.directory.listByRole, { role: 'DiveMaster' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('dm-ok')
  })
})
