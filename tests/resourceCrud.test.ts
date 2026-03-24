/**
 * Resource CRUD — Integration Tests
 *
 * Parameterized tests covering create/update/mine/byUserId for all resource types:
 * equipment, boats, venues, instructors, diveMasters, compressors, diveCenters.
 * (agents.test.ts already covers agents.)
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUser } from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

// ─── Resource configs ─────────────────────────────────────────────────────────

const COMMON_LOCATION = {
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.09,
  lng: 99.84,
  contactEmail: 'test@test.com',
  contactPhone: '+66123456789',
  focusedLanguages: ['en'],
}

// Each entry: { apiModule, role, createArgs, updateArgs, uniqueField }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrudApi = { create: any; update: any; mine: any; byUserId: any }

const RESOURCE_CONFIGS: Array<{
  name: string
  apiModule: CrudApi
  role: Doc<'users'>['role']
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
  {
    name: 'venues',
    apiModule: api.venues as CrudApi,
    role: 'Pool',
    createArgs: {
      name: 'Test Venue',
      ...COMMON_LOCATION,
      venueType: 'Pool',
      isPublic: true,
      confinedCapable: true,
      openWaterCapable: false,
      hasCompressor: false,
    },
    updateArgs: { name: 'Updated Venue' },
    uniqueField: 'name',
  },
  {
    name: 'instructors',
    apiModule: api.instructors as CrudApi,
    role: 'Instructor',
    createArgs: {
      name: 'Test Instructor',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.09,
      lng: 99.84,
      contactEmail: 'instr@test.com',
      contactPhone: '+66123456789',
      languages: ['en'],
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '123', courses: ['OW', 'AOW'] }],
    },
    updateArgs: { name: 'Updated Instructor' },
    uniqueField: 'name',
  },
  {
    name: 'diveMasters',
    apiModule: api.diveMasters as CrudApi,
    role: 'DiveMaster',
    createArgs: {
      name: 'Test DM',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.09,
      lng: 99.84,
      contactEmail: 'dm@test.com',
      contactPhone: '+66123456789',
      languages: ['en'],
      credential: [{ agency: 'PADI', level: 'DM', agencyID: '456' }],
    },
    updateArgs: { name: 'Updated DM' },
    uniqueField: 'name',
  },
  {
    name: 'compressors',
    apiModule: api.compressors as CrudApi,
    role: 'Compressor',
    createArgs: { name: 'Test Compressor', ...COMMON_LOCATION },
    updateArgs: { name: 'Updated Compressor' },
    uniqueField: 'name',
  },
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
          await seedUser(ctx, { slug: 'wrong-role', tokenIdentifier: 'clerk|wrong-role', role: wrongRole as Doc<'users'>['role'] })
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
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        const id = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        expect(id).toBeTruthy()

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id) as Record<string, unknown> | null
          expect(record).toBeTruthy()
          expect(record![config.uniqueField]).toBe(config.createArgs.name)
          expect(record!.verified).toBe(false)
        })
      })

      it('returns existing ID on duplicate create (idempotent)', async () => {
        const t = makeT()
        const slug = `${config.name}-dup`
        await t.run(async (ctx) => {
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        const id1 = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)
        const id2 = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, { ...config.createArgs, name: 'Different' })

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
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        await expect(
          t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
            .mutation(config.apiModule.update, config.updateArgs),
        ).rejects.toThrow(/NOT_FOUND/)
      })

      it('updates profile fields', async () => {
        const t = makeT()
        const slug = `${config.name}-upd`
        await t.run(async (ctx) => {
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        // Create first
        const id = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        // Update
        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.update, config.updateArgs)

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id) as Record<string, unknown> | null
          expect(record![config.uniqueField]).toBe(
            config.updateArgs[config.uniqueField],
          )
        })
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
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        const result = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .query(config.apiModule.mine, {})
        expect(result).toBeNull()
      })

      it('returns own profile when it exists', async () => {
        const t = makeT()
        const slug = `${config.name}-mine`
        await t.run(async (ctx) => {
          await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        const result = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .query(config.apiModule.mine, {})
        expect(result).toBeTruthy()
        expect((result as Record<string, unknown>).name).toBe(config.createArgs.name)
      })
    })

    // ── byUserId ──

    describe(`${config.name}.byUserId`, () => {
      it('returns profile by userId', async () => {
        const t = makeT()
        const slug = `${config.name}-byuid`
        let userId!: Id<'users'>
        await t.run(async (ctx) => {
          userId = await seedUser(ctx, { slug, tokenIdentifier: `clerk|${slug}`, role: config.role })
        })

        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        const result = await t.query(config.apiModule.byUserId, { userId })
        expect(result).toBeTruthy()
        expect((result as Record<string, unknown>).name).toBe(config.createArgs.name)
      })

      it('returns null for non-existent userId', async () => {
        const t = makeT()
        // Seed a user so we have a valid-looking ID format, but don't create a profile
        let userId!: Id<'users'>
        await t.run(async (ctx) => {
          userId = await seedUser(ctx, { slug: 'no-profile', tokenIdentifier: 'clerk|no-profile', role: config.role })
        })

        const result = await t.query(config.apiModule.byUserId, { userId })
        expect(result).toBeNull()
      })
    })
  })
}
