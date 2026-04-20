import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedInstructorProfile, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Instructor' | 'DiveCenter' = 'Instructor') {
  const userId = await _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

const VALID_INSTRUCTOR_ARGS = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'instr@test.com',
  phone: '+66123456789',
  credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '12345', specialtyRatings: ['OW', 'AOW'] }],
  teachingLanguages: ['en'],
}

describe('instructors.create', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Instructor roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dc-user', 'DiveCenter') })
    await expect(
      t.withIdentity(orgIdentityFor('dc-user')).mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates instructor profile for Instructor user with name derived from user firstName+lastName', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'new-instr') })

    const instrId = await t.withIdentity(orgIdentityFor('new-instr'))
      .mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)

    expect(typeof instrId).toBe('string')
    await t.run(async (ctx) => {
      const instr = await ctx.db.get(instrId as Id<'diveStaff'>) as Doc<'diveStaff'> | null
      expect(instr).not.toBeNull()
      expect(instr!.name).toBe('new-instr Test')
      expect(instr!.organizationId).toBeDefined()
      expect(instr!.verified).toBe(false)
      expect(instr!.credential).toHaveLength(1)
      expect(instr!.credential[0].agency).toBe('PADI')
    })
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-instr') })
    const identity = orgIdentityFor('dup-instr')

    const id1 = await t.withIdentity(identity).mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.instructors.create, { ...VALID_INSTRUCTOR_ARGS, phone: '+66999999999' })
    expect(id1).toBe(id2)
  })
})

describe('instructors.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.instructors.update, { phone: '+660000000000' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-instr') })
    await expect(
      t.withIdentity(orgIdentityFor('no-instr')).mutation(api.instructors.update, { phone: '+660000000000' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates instructor fields and re-derives name from user', async () => {
    const t = makeT()
    let instrId: Awaited<ReturnType<typeof seedInstructorProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-instr')
      instrId = await seedInstructorProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('upd-instr'))
      .mutation(api.instructors.update, { phone: '+660000000000' })

    await t.run(async (ctx) => {
      const instr = await ctx.db.get(instrId!) as Doc<'diveStaff'> | null
      expect(instr!.phone).toBe('+660000000000')
      expect(instr!.name).toBe('upd-instr Test')
    })
  })

  it('users.updateProfile syncs diveStaff.name when firstName changes', async () => {
    const t = makeT()
    let instrId: Awaited<ReturnType<typeof seedInstructorProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'sync-instr')
      instrId = await seedInstructorProfile(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('sync-instr'))
      .mutation(api.users.updateProfile, { firstName: 'Renamed' })

    await t.run(async (ctx) => {
      const instr = await ctx.db.get(instrId!) as Doc<'diveStaff'> | null
      expect(instr!.name).toBe('Renamed Test')
    })
  })
})

describe('directory.listByRole — Instructor picker gate', () => {
  it('excludes instructors with empty teachingLanguages array', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-instr', 'DiveCenter')
      const u1 = await seedUser(ctx, 'instr-empty', 'Instructor')
      await seedInstructorProfile(ctx, u1, { teachingLanguages: [] })
    })

    const result = await t.withIdentity(orgIdentityFor('caller-instr'))
      .query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(0)
  })

  it('includes instructors with at least one teachingLanguage', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'caller-instr2', 'DiveCenter')
      const u1 = await seedUser(ctx, 'instr-ok', 'Instructor')
      await seedInstructorProfile(ctx, u1, { teachingLanguages: ['zh-TW'] })
    })

    const result = await t.withIdentity(orgIdentityFor('caller-instr2'))
      .query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('instr-ok')
  })
})

describe('instructors.create — teachingLanguages empty-array gate (P0-20)', () => {
  it('rejects empty teachingLanguages on create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'empty-lang') })

    await expect(
      t.withIdentity(orgIdentityFor('empty-lang'))
        .mutation(api.instructors.create, { ...VALID_INSTRUCTOR_ARGS, teachingLanguages: [] }),
    ).rejects.toThrow(/TEACHING_LANGUAGES_REQUIRED/)
  })

  it('rejects empty teachingLanguages on update', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'regress-lang')
      await seedInstructorProfile(ctx, userId)
    })

    await expect(
      t.withIdentity(orgIdentityFor('regress-lang'))
        .mutation(api.instructors.update, { teachingLanguages: [] }),
    ).rejects.toThrow(/TEACHING_LANGUAGES_REQUIRED/)
  })
})

describe('instructors.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()
    expect(await t.query(api.instructors.mine, {})).toBeNull()
  })

  it('returns null when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-instr-profile') })
    expect(
      await t.withIdentity(orgIdentityFor('no-instr-profile')).query(api.instructors.mine, {}),
    ).toBeNull()
  })

  it('returns instructor profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-instr')
      await seedInstructorProfile(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('my-instr')).query(api.instructors.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Instructor')
  })
})
