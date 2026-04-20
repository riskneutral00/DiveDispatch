/**
 * @module-tag slow
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { seedUser as _seedUser, getOrCreateTestOrg, type SeedCtx } from '../fixtures'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'


async function seedUser(ctx: SeedCtx, slug: string) {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: `${slug} Display`, firstName: slug, lastName: 'Test' })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}


describe('diveCenters.create (profile setup)', () => {
  it('writes all required fields to diveCenters', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, 'profile-dc-01'))

    const id = await t.withIdentity(orgIdentityFor('profile-dc-01'))
      .mutation(api.diveCenters.create, {
        name: "Matt & Miss Mermaid's DC",
        placeName: 'Phuket',
        lat: 7.8804,
        lng: 98.3923,
        country: 'Thailand',
        email: 'matt@divedispatch.dev',
        phone: '+66812345678',
        associations: [{ agency: 'PADI', number: '12345' }],
      })

    const profile = await t.run(async (ctx) => ctx.db.get(id as Id<'diveCenters'>))
    expect(profile?.name).toBe("Matt & Miss Mermaid's DC")
    expect(profile?.placeName).toBe('Phuket')
    expect(profile?.country).toBe('Thailand')
    expect(profile?.email).toBe('matt@divedispatch.dev')
    expect(profile?.phone).toBe('+66812345678')
    expect(profile?.associations).toHaveLength(1)
    expect(profile?.associations[0].agency).toBe('PADI')
  })

  it('is idempotent — returns existing record ID on second call', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, 'profile-dc-02'))

    const args = {
      name: 'Idempotent DC',
      placeName: 'Koh Tao',
      lat: 10.0957,
      lng: 99.8408,
      country: 'Thailand',
      email: 'idem@dc.com',
      phone: '+66800000000',
      associations: [] as { agency: string; number: string }[],
    }

    const id1 = await t.withIdentity(orgIdentityFor('profile-dc-02'))
      .mutation(api.diveCenters.create, args)
    const id2 = await t.withIdentity(orgIdentityFor('profile-dc-02'))
      .mutation(api.diveCenters.create, { ...args, name: 'Different Name' })

    expect(id1).toBe(id2)
  })

  it('rejects callers who are not DiveCenter role', async () => {
    const t = makeT()
    await t.run(async (ctx) =>
      _seedUser(ctx, {
        tokenIdentifier: 'clerk|profile-inst-01',
        slug: 'profile-inst-01',
        email: 'inst@test.com',
        name: 'Inst User',
        firstName: 'Inst',
        lastName: 'Test',
        role: 'Instructor',
      }),
    )

    await expect(
      t.withIdentity(orgIdentityFor('profile-inst-01'))
        .mutation(api.diveCenters.create, {
          name: 'Bad Actor',
          placeName: 'Phuket',
        lat: 7.8804,
        lng: 98.3923,
          country: 'Thailand',
          email: 'bad@test.com',
          phone: '+66800000000',
          associations: [],
        }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })
})
