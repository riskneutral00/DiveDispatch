/**
 * Resource CRUD — Integration Tests
 *
 * Parameterized tests covering create/update/mine/byUserId for all resource types:
 * equipment, boats, venues, instructors, diveMasters, compressors, diveCenters.
 * (agents.test.ts already covers agents.)
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

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
const RESOURCE_CONFIGS = [
  {
    name: 'equipment',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.equipment as any,
    role: 'Equipment',
    createArgs: { name: 'Test Equip', ...COMMON_LOCATION },
    updateArgs: { name: 'Updated Equip' },
    uniqueField: 'name',
  },
  {
    name: 'boats',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.boats as any,
    role: 'Boat',
    createArgs: { name: 'Test Boat', ...COMMON_LOCATION, fleet: [] },
    updateArgs: { name: 'Updated Boat' },
    uniqueField: 'name',
  },
  {
    name: 'venues',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.venues as any,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.instructors as any,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.diveMasters as any,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.compressors as any,
    role: 'Compressor',
    createArgs: { name: 'Test Compressor', ...COMMON_LOCATION },
    updateArgs: { name: 'Updated Compressor' },
    uniqueField: 'name',
  },
  {
    name: 'diveCenters',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiModule: api.diveCenters as any,
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
          await seedUser(ctx, 'wrong-role', wrongRole)
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
          await seedUser(ctx, slug, config.role)
        })

        const id = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        expect(id).toBeTruthy()

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id as any)
          expect(record).toBeTruthy()
          expect((record as any)[config.uniqueField]).toBe(config.createArgs.name)
          expect((record as any).verified).toBe(false)
        })
      })

      it('returns existing ID on duplicate create (idempotent)', async () => {
        const t = makeT()
        const slug = `${config.name}-dup`
        await t.run(async (ctx) => {
          await seedUser(ctx, slug, config.role)
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
          await seedUser(ctx, slug, config.role)
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
          await seedUser(ctx, slug, config.role)
        })

        // Create first
        const id = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        // Update
        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.update, config.updateArgs)

        await t.run(async (ctx) => {
          const record = await ctx.db.get(id as any)
          expect((record as any)[config.uniqueField]).toBe(
            (config.updateArgs as any)[config.uniqueField],
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
          await seedUser(ctx, slug, config.role)
        })

        const result = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .query(config.apiModule.mine, {})
        expect(result).toBeNull()
      })

      it('returns own profile when it exists', async () => {
        const t = makeT()
        const slug = `${config.name}-mine`
        await t.run(async (ctx) => {
          await seedUser(ctx, slug, config.role)
        })

        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        const result = await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .query(config.apiModule.mine, {})
        expect(result).toBeTruthy()
        expect((result as any).name).toBe(config.createArgs.name)
      })
    })

    // ── byUserId ──

    describe(`${config.name}.byUserId`, () => {
      it('returns profile by userId', async () => {
        const t = makeT()
        const slug = `${config.name}-byuid`
        let userId: any
        await t.run(async (ctx) => {
          userId = await seedUser(ctx, slug, config.role)
        })

        await t.withIdentity({ tokenIdentifier: `clerk|${slug}` })
          .mutation(config.apiModule.create, config.createArgs)

        const result = await t.query(config.apiModule.byUserId, { userId })
        expect(result).toBeTruthy()
        expect((result as any).name).toBe(config.createArgs.name)
      })

      it('returns null for non-existent userId', async () => {
        const t = makeT()
        // Seed a user so we have a valid-looking ID format, but don't create a profile
        let userId: any
        await t.run(async (ctx) => {
          userId = await seedUser(ctx, 'no-profile', config.role)
        })

        const result = await t.query(config.apiModule.byUserId, { userId })
        expect(result).toBeNull()
      })
    })
  })
}
