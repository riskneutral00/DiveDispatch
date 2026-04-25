/**
 * Resource CRUD — Integration Tests
 *
 * Parameterized tests covering create/update/mine for all resource types:
 * equipment, boats, venues, instructors, diveMasters, compressors, diveCenters.
 * (agents.test.ts already covers agents.)
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser, getOrCreateTestOrg, type SeedCtx } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

async function seedUserWithOrg(
  ctx: SeedCtx,
  slug: string,
  role: Doc<'userRoles'>['role'],
): Promise<Id<'users'>> {
  const userId = await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role })
  await getOrCreateTestOrg(ctx, userId, slug)
  return userId
}

// ─── Resource configs ─────────────────────────────────────────────────────────

const COMMON_LOCATION = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'test@test.com',
  phone: '+66123456789',
}

// Each entry: { apiModule, role, createArgs, updateArgs, uniqueField }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrudApi = { create: any; update: any; mine: any }

const RESOURCE_CONFIGS: Array<{
  name: string
  apiModule: CrudApi
  role: Doc<'userRoles'>['role']
  createArgs: Record<string, unknown>
  updateArgs: Record<string, unknown>
  uniqueField: string
}> = [
  {
    name: 'equipment',
    apiModule: api.equipment as CrudApi,
    role: 'Equipment',
    createArgs: { name: 'Test Equip', ...COMMON_LOCATION },
    updateArgs: { name: 'Updated Equip' },
    uniqueField: 'name',
  },
  {
    name: 'boats',
    apiModule: api.boats as CrudApi,
    role: 'Boat',
    createArgs: { name: 'Test Boat', ...COMMON_LOCATION, fleet: [] },
    updateArgs: { name: 'Updated Boat' },
    uniqueField: 'name',
  },
  // venues removed from shared CRUD driver: multi-row model requires
  // venueId in update args and returns an array from mine. Pending rewrite
  // as dedicated multi-venue CRUD suite (tests/venues.test.ts).
  {
    name: 'diveStaff',
    apiModule: api.instructors as CrudApi,
    role: 'Instructor',
    createArgs: {
      address: { city: 'Koh Tao', country: 'TH' },
      lat: 10.09,
      lng: 99.84,
      email: 'instr@test.com',
      phone: '+66123456789',
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '123', specialtyRatings: ['OW', 'AOW'] }],
      teachingLanguages: ['en'],
    },
    updateArgs: { phone: '+66999999999' },
    uniqueField: 'phone',
  },
  // compressors removed from shared CRUD driver: multi-row model requires
  // compressorId in update args (not implicit-by-org), and location/slug
  // semantics differ from the singular profile pattern. Covered directly by
  // tests/compressors.test.ts.
  {
    name: 'diveCenters',
    apiModule: api.diveCenters as CrudApi,
    role: 'DiveCenter',
    createArgs: {
      name: 'Test DC',
      ...COMMON_LOCATION,
      associations: [{ agency: 'PADI', number: '12345' }],
    },
    updateArgs: { name: 'Updated DC' },
    uniqueField: 'name',
  },
]

// ─── Parameterized tests ──────────────────────────────────────────────────────

for (const config of RESOURCE_CONFIGS) {
  describe(`${config.name} CRUD`, () => {
    // ── create ──

    describe(`${config.name}.create`, () => {
      it('rejects unauthenticated caller', async () => {
        const t = makeT()
        await expect(
          t.mutation(config.apiModule.create, config.createArgs),
        ).rejects.toThrow(/UNAUTHENTICATED/)
      })

      it('rejects wrong role with FORBIDDEN', async () => {
        const t = makeT()
        const wrongRole = config.role === 'Instructor' ? 'Equipment' : 'Instructor'
        await t.run(async (ctx) => {
          await seedUser(ctx, { slug: 'wrong-role', tokenIdentifier: 'clerk|wrong-role', role: wrongRole as Doc<'userRoles'>['role'] })
        })

        await expect(
          t.withIdentity({ tokenIdentifier: 'clerk|wrong-role' })
            .mutation(config.apiModule.create, config.createArgs),
        ).rejects.toThrow(/FORBIDDEN/)
      })

      it('creates profile for correct role', async () => {
        const t = makeT()
        const slug = `${config.name}-user`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        const id = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        expect(typeof id).toBe('string')

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id) as Record<string, unknown> | null
          expect(record).not.toBeNull()
          expect(record![config.uniqueField]).toBe(config.createArgs[config.uniqueField])
          expect(record!.verified).toBe(false)
        })
      })

      it('returns existing ID on duplicate create (idempotent)', async () => {
        const t = makeT()
        const slug = `${config.name}-dup`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        const id1 = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)
        const id2 = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, { ...config.createArgs, [config.uniqueField]: 'different-marker-value' })

        expect(id1).toBe(id2)
      })
    })

    // ── update ──

    describe(`${config.name}.update`, () => {
      it('rejects unauthenticated caller', async () => {
        const t = makeT()
        await expect(
          t.mutation(config.apiModule.update, config.updateArgs),
        ).rejects.toThrow(/UNAUTHENTICATED/)
      })

      it('rejects when no profile exists', async () => {
        const t = makeT()
        const slug = `${config.name}-noprof`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        await expect(
          t.withIdentity(orgIdentityFor(slug))
            .mutation(config.apiModule.update, config.updateArgs),
        ).rejects.toThrow(/NOT_FOUND/)
      })

      it('updates profile fields', async () => {
        const t = makeT()
        const slug = `${config.name}-upd`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        // Create first
        const id = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        // Update
        await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.update, config.updateArgs)

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id) as Record<string, unknown> | null
          expect(record![config.uniqueField]).toBe(
            config.updateArgs[config.uniqueField],
          )
        })
      })

      it('rejects protected fields (verified) in update args via validator', async () => {
        const t = makeT()
        const slug = `${config.name}-prot`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        await expect(
          t.withIdentity(orgIdentityFor(slug))
            .mutation(config.apiModule.update, { ...config.updateArgs, verified: true }),
        ).rejects.toThrow(/verified/)
      })
    })

    // ── mine ──

    describe(`${config.name}.mine`, () => {
      it('returns null for unauthenticated caller', async () => {
        const t = makeT()
        const result = await t.query(config.apiModule.mine, {})
        expect(result).toBeNull()
      })

      it('returns null when no profile exists', async () => {
        const t = makeT()
        const slug = `${config.name}-nomine`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        const result = await t.withIdentity(orgIdentityFor(slug))
          .query(config.apiModule.mine, {})
        expect(result).toBeNull()
      })

      it('returns own profile when it exists', async () => {
        const t = makeT()
        const slug = `${config.name}-mine`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        const result = await t.withIdentity(orgIdentityFor(slug))
          .query(config.apiModule.mine, {})
        expect(result).not.toBeNull()
        expect((result as Record<string, unknown>)[config.uniqueField]).toBe(config.createArgs[config.uniqueField])
      })
    })

  })
}
