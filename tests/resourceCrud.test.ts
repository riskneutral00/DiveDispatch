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

type ResourceConfig = {
  name: string
  apiModule: CrudApi
  role: Doc<'userRoles'>['role']
  kind: 'person' | 'entity'
  createArgs: Record<string, unknown>
  updateArgs: Record<string, unknown>
  uniqueField: string
}

const RESOURCE_CONFIGS: Array<ResourceConfig> = [
  {
    name: 'equipment',
    apiModule: api.equipment as CrudApi,
    role: 'Equipment',
    kind: 'entity',
    createArgs: { name: 'Test Equip', ...COMMON_LOCATION },
    updateArgs: { name: 'Updated Equip' },
    uniqueField: 'name',
  },
  {
    name: 'boats',
    apiModule: api.boats as CrudApi,
    role: 'Boat',
    kind: 'entity',
    createArgs: { name: 'Test Boat', ...COMMON_LOCATION, fleet: [] },
    updateArgs: { name: 'Updated Boat' },
    uniqueField: 'name',
  },
  // venues removed from shared CRUD driver: multi-row model requires
  // venueId in update args and returns an array from mine. Pending rewrite
  // as dedicated multi-venue CRUD suite (tests/venues.test.ts).
  {
    name: 'diveStaff',
    apiModule: api.diveStaff as CrudApi,
    role: 'Instructor',
    kind: 'person',
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
    kind: 'entity',
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

      it(
        config.kind === 'person'
          ? 'returns existing ID on duplicate create (idempotent)'
          : 'second create with distinct unique-field mints distinct row (multi-row entity)',
        async () => {
          const t = makeT()
          const slug = `${config.name}-dup`
          await t.run(async (ctx) => {
            await seedUserWithOrg(ctx, slug, config.role)
          })

          const id1 = await t.withIdentity(orgIdentityFor(slug))
            .mutation(config.apiModule.create, config.createArgs)
          const id2 = await t.withIdentity(orgIdentityFor(slug))
            .mutation(config.apiModule.create, { ...config.createArgs, [config.uniqueField]: 'different-marker-value' })

          if (config.kind === 'person') {
            expect(id1).toBe(id2)
          } else {
            expect(id1).not.toBe(id2)
          }
        },
      )
    })

    // ── update ──

    const buildUpdateArgs = async (
      t: ReturnType<typeof makeT>,
      slug: string,
    ): Promise<Record<string, unknown>> => {
      if (config.kind === 'person') return config.updateArgs
      const id = await t.withIdentity(orgIdentityFor(slug))
        .mutation(config.apiModule.create, config.createArgs)
      return { ...config.updateArgs, entityId: id }
    }

    describe(`${config.name}.update`, () => {
      it('rejects unauthenticated caller', async () => {
        const t = makeT()
        if (config.kind === 'entity') {
          // Need a real id for the validator to accept the call before auth check.
          const slug = `${config.name}-unauth`
          await t.run(async (ctx) => {
            await seedUserWithOrg(ctx, slug, config.role)
          })
          const args = await buildUpdateArgs(t, slug)
          await expect(t.mutation(config.apiModule.update, args)).rejects.toThrow(/UNAUTHENTICATED/)
        } else {
          await expect(
            t.mutation(config.apiModule.update, config.updateArgs),
          ).rejects.toThrow(/UNAUTHENTICATED/)
        }
      })

      it('rejects when no profile exists', async () => {
        const t = makeT()
        const slug = `${config.name}-noprof`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        if (config.kind === 'entity') {
          const otherSlug = `${config.name}-otherowner`
          let strangerId: unknown
          await t.run(async (ctx) => {
            await seedUserWithOrg(ctx, otherSlug, config.role)
          })
          strangerId = await t.withIdentity(orgIdentityFor(otherSlug))
            .mutation(config.apiModule.create, config.createArgs)
          await t.run(async (ctx) => {
            await ctx.db.delete(strangerId as Id<'diveCenters'>)
          })
          await expect(
            t.withIdentity(orgIdentityFor(slug))
              .mutation(config.apiModule.update, { ...config.updateArgs, entityId: strangerId }),
          ).rejects.toThrow(/NOT_FOUND/)
        } else {
          await expect(
            t.withIdentity(orgIdentityFor(slug))
              .mutation(config.apiModule.update, config.updateArgs),
          ).rejects.toThrow(/NOT_FOUND/)
        }
      })

      it('updates profile fields', async () => {
        const t = makeT()
        const slug = `${config.name}-upd`
        await t.run(async (ctx) => {
          await seedUserWithOrg(ctx, slug, config.role)
        })

        const id = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        const updateArgs = config.kind === 'entity'
          ? { ...config.updateArgs, entityId: id }
          : config.updateArgs
        await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.update, updateArgs)

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

        const id = await t.withIdentity(orgIdentityFor(slug))
          .mutation(config.apiModule.create, config.createArgs)

        const updateArgs = config.kind === 'entity'
          ? { ...config.updateArgs, entityId: id, verified: true }
          : { ...config.updateArgs, verified: true }
        await expect(
          t.withIdentity(orgIdentityFor(slug))
            .mutation(config.apiModule.update, updateArgs),
        ).rejects.toThrow(/verified/)
      })
    })

    // ── mine ──

    describe(`${config.name}.mine`, () => {
      it(
        config.kind === 'person' ? 'returns null for unauthenticated caller' : 'returns empty array for unauthenticated caller',
        async () => {
          const t = makeT()
          const result = await t.query(config.apiModule.mine, {})
          if (config.kind === 'person') {
            expect(result).toBeNull()
          } else {
            expect(result).toEqual([])
          }
        },
      )

      it(
        config.kind === 'person' ? 'returns null when no profile exists' : 'returns empty array when no profile exists',
        async () => {
          const t = makeT()
          const slug = `${config.name}-nomine`
          await t.run(async (ctx) => {
            await seedUserWithOrg(ctx, slug, config.role)
          })

          const result = await t.withIdentity(orgIdentityFor(slug))
            .query(config.apiModule.mine, {})
          if (config.kind === 'person') {
            expect(result).toBeNull()
          } else {
            expect(result).toEqual([])
          }
        },
      )

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
        const row = config.kind === 'person'
          ? (result as Record<string, unknown>)
          : ((result as Array<Record<string, unknown>>)[0])
        expect(row).toBeDefined()
        expect(row[config.uniqueField]).toBe(config.createArgs[config.uniqueField])
      })
    })

  })
}
