import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser as _seedUser, seedInstructorProfile, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

async function seedUser(ctx: SeedCtx, slug: string, role: 'Instructor' | 'DiveMaster' | 'DiveCenter' = 'Instructor') {
  return _seedUser(ctx, { tokenIdentifier: `clerk|${slug}`, slug, email: `${slug}@test.com`, name: slug, firstName: slug, lastName: 'Test', role })
}

const VALID_INSTRUCTOR_ARGS = {
  name: 'Jane Instructor',
  placeName: 'Koh Tao',
  country: 'Thailand',
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

  it('rejects non-Instructor/DiveMaster roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dc-user', 'DiveCenter') })
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-user' }).mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates instructor profile for Instructor user', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => { userId = await seedUser(ctx, 'new-instr') })

    const instrId = await t.withIdentity({ tokenIdentifier: 'clerk|new-instr' })
      .mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)

    expect(typeof instrId).toBe('string')
    await t.run(async (ctx) => {
      const instr = await ctx.db.get(instrId as Id<'instructors'>) as Doc<'instructors'> | null
      expect(instr).not.toBeNull()
      expect(instr!.name).toBe('Jane Instructor')
      expect(instr!.userId).toEqual(userId)
      expect(instr!.verified).toBe(false)
      expect(instr!.credential).toHaveLength(1)
      expect(instr!.credential[0].agency).toBe('PADI')
    })
  })

  it('allows DiveMaster role to create instructor profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dm-user', 'DiveMaster') })

    const instrId = await t.withIdentity({ tokenIdentifier: 'clerk|dm-user' })
      .mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)

    expect(typeof instrId).toBe('string')
  })

  it('returns existing ID on duplicate create', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'dup-instr') })
    const identity = { tokenIdentifier: 'clerk|dup-instr' }

    const id1 = await t.withIdentity(identity).mutation(api.instructors.create, VALID_INSTRUCTOR_ARGS)
    const id2 = await t.withIdentity(identity).mutation(api.instructors.create, { ...VALID_INSTRUCTOR_ARGS, name: 'Other' })
    expect(id1).toBe(id2)
  })
})

describe('instructors.update', () => {
  it('rejects unauthenticated callers', async () => {
    const t = makeT()
    await expect(t.mutation(api.instructors.update, { name: 'New' })).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'no-instr') })
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|no-instr' }).mutation(api.instructors.update, { name: 'New' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates instructor fields', async () => {
    const t = makeT()
    let instrId: Awaited<ReturnType<typeof seedInstructorProfile>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-instr')
      instrId = await seedInstructorProfile(ctx, userId)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|upd-instr' })
      .mutation(api.instructors.update, { name: 'Updated Instructor' })

    await t.run(async (ctx) => {
      const instr = await ctx.db.get(instrId!) as Doc<'instructors'> | null
      expect(instr!.name).toBe('Updated Instructor')
      expect(instr!.email).toBe('instructor@test.com')
    })
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
      await t.withIdentity({ tokenIdentifier: 'clerk|no-instr-profile' }).query(api.instructors.mine, {}),
    ).toBeNull()
  })

  it('returns instructor profile for owner', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-instr')
      await seedInstructorProfile(ctx, userId)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|my-instr' }).query(api.instructors.mine, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Instructor')
  })
})
