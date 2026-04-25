import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  seedUser as _seedUser,
  seedDiveCenterProfile,
  seedAgent,
  seedEquipmentProfile,
  getOrCreateTestOrg,
  type SeedCtx,
} from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'
import type { Doc, Id } from '../convex/_generated/dataModel'

async function seedUserForSlug(
  ctx: SeedCtx,
  slug: string,
  role: Doc<'userRoles'>['role'] = 'DiveCenter',
): Promise<Id<'users'>> {
  const userId = await _seedUser(ctx, {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: slug,
    firstName: slug,
    lastName: 'Test',
    role,
  })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

async function addUserRole(
  ctx: SeedCtx,
  userId: Id<'users'>,
  role: Doc<'userRoles'>['role'],
): Promise<void> {
  const user = await ctx.db.get(userId)
  if (!user?.organizationId) throw new Error('user missing organizationId')
  await ctx.db.insert('userRoles', {
    userId,
    role,
    organizationId: user.organizationId,
    createdAt: Date.now(),
  })
}

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('users.inheritedContactDefaults', () => {
  it('returns null for unauthenticated caller', async () => {
    const result = await t.query(api.users.inheritedContactDefaults, {
      excludeRole: 'Compressor',
    })
    expect(result).toBeNull()
  })

  it('returns null when user has only the excluded role', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'solo-dc', 'DiveCenter')
      await seedDiveCenterProfile(ctx, userId, { name: 'Solo DC' })
    })

    const result = await t
      .withIdentity(orgIdentityFor('solo-dc'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'DiveCenter',
      })

    expect(result).toBeNull()
  })

  it('returns DiveCenter contact when user adds Compressor', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'dc-plus-comp', 'DiveCenter')
      await seedDiveCenterProfile(ctx, userId, {
        name: 'Sea Fun Divers',
        email: 'hello@seafun.example',
        phone: '+66999888777',
        address: { city: 'Phuket', country: 'TH' },
      })
      await addUserRole(ctx, userId, 'Compressor')
    })

    const result = await t
      .withIdentity(orgIdentityFor('dc-plus-comp'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Compressor',
      })

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Sea Fun Divers')
    expect(result!.email).toBe('hello@seafun.example')
    expect(result!.phone).toBe('+66999888777')
    expect(result!.address).toEqual({ city: 'Phuket', country: 'TH' })
  })

  it('prefers Agent over DiveCenter (Agent has highest precedence among operators)', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'triple', 'DiveCenter')
      const user = await ctx.db.get(userId)
      const orgId = user!.organizationId!
      await seedDiveCenterProfile(ctx, userId, { name: 'The DC', email: 'dc@x.example' })
      await addUserRole(ctx, userId, 'Agent')
      await seedAgent(ctx, userId, {
        name: 'The Agent',
        email: 'agent@x.example',
        organizationId: orgId,
      })
      await addUserRole(ctx, userId, 'Equipment')
    })

    const result = await t
      .withIdentity(orgIdentityFor('triple'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Equipment',
      })

    expect(result!.name).toBe('The Agent')
    expect(result!.email).toBe('agent@x.example')
  })

  it('falls through to Agent when DiveCenter profile not yet saved', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'multi-roler', 'DiveCenter')
      const user = await ctx.db.get(userId)
      const orgId = user!.organizationId!
      await addUserRole(ctx, userId, 'Agent')
      await seedAgent(ctx, userId, {
        name: 'Only Agent Profile',
        email: 'agent-only@x.example',
        organizationId: orgId,
      })
      await addUserRole(ctx, userId, 'Venue')
    })

    const result = await t
      .withIdentity(orgIdentityFor('multi-roler'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Venue',
      })

    expect(result!.name).toBe('Only Agent Profile')
    expect(result!.email).toBe('agent-only@x.example')
  })

  it('returns null when only other roles are Instructor (non-source role)', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'instr-only', 'Instructor')
      const user = await ctx.db.get(userId)
      const orgId = user!.organizationId!
      await ctx.db.insert('diveStaff', {
        organizationId: orgId,
        role: 'Instructor',
        name: 'John Personal Name',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'john@personal.example',
        phone: '+66111222333',
        credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '1', specialtyRatings: [] }],
        verified: true,
        teachingLanguages: ['en'],
      })
      await addUserRole(ctx, userId, 'Compressor')
    })

    const result = await t
      .withIdentity(orgIdentityFor('instr-only'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Compressor',
      })

    expect(result).toBeNull()
  })

  it('omits placeId when source profile has none (no null leak into Convex payloads)', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'no-placeid', 'DiveCenter')
      await seedDiveCenterProfile(ctx, userId, { name: 'No PlaceId DC' })
      await addUserRole(ctx, userId, 'Compressor')
    })

    const result = await t
      .withIdentity(orgIdentityFor('no-placeid'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Compressor',
      })

    expect(result).not.toBeNull()
    expect(result!.name).toBe('No PlaceId DC')
    expect('placeId' in result!).toBe(false)
  })

  it('submits inherited shape through api.compressors.create without null-rejection', async () => {
    let orgId!: import('../convex/_generated/dataModel').Id<'organizations'>
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'inherit-submit', 'DiveCenter')
      await seedDiveCenterProfile(ctx, userId, {
        name: 'Source DC',
        email: 'source@dc.example',
        phone: '+66123456789',
        address: { city: 'Phuket', country: 'TH' },
      })
      await addUserRole(ctx, userId, 'Compressor')
      const user = await ctx.db.get(userId)
      orgId = user!.organizationId!
    })

    const inherited = await t
      .withIdentity(orgIdentityFor('inherit-submit'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Compressor',
      })
    expect(inherited).not.toBeNull()

    const payload = {
      name: 'My Compressor Biz',
      location: 'fixed' as const,
      address: { city: 'Bangkok', country: 'TH' },
      lat: 13.75,
      lng: 100.5,
      email: inherited!.email,
      phone: inherited!.phone,
      ...(inherited!.placeId !== undefined ? { placeId: inherited!.placeId } : {}),
    }

    const created = await t
      .withIdentity(orgIdentityFor('inherit-submit'))
      .mutation(api.compressors.create, payload)

    expect(created).toBeTruthy()

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('compressors')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
        .unique()
      expect(row).not.toBeNull()
      expect(row!.name).toBe('My Compressor Biz')
      expect(row!.address.city).toBe('Bangkok')
    })
  })

  it('returns Equipment contact when added role is Venue and only Equipment profile exists', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUserForSlug(ctx, 'eq-plus-venue', 'Equipment')
      const user = await ctx.db.get(userId)
      const orgId = user!.organizationId!
      await seedEquipmentProfile(ctx, userId, {
        name: 'Gear Rentals LLC',
        email: 'rentals@x.example',
        phone: '+66555666777',
        organizationId: orgId,
      })
      await addUserRole(ctx, userId, 'Venue')
    })

    const result = await t
      .withIdentity(orgIdentityFor('eq-plus-venue'))
      .query(api.users.inheritedContactDefaults, {
        excludeRole: 'Venue',
      })

    expect(result!.name).toBe('Gear Rentals LLC')
    expect(result!.email).toBe('rentals@x.example')
  })
})
