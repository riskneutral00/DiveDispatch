import { describe, it, expect, beforeEach } from 'vitest'
import { checkProfileCompleteness } from '../convex/lib/profileCompleteness'
import {
  seedUser,
  seedDiveCenterProfile,
  seedInstructorProfile,
  seedBoatProfile,
  seedAgent,
  getOrCreateTestOrg,
  type SeedCtx,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Instructor credential: hollow inner fields ────────────────────────────

describe('prerequisite gate: Instructor — credential depth', () => {
  it('hollow credential (blank agency + empty courses) must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: '', level: 'OWSI', agencyID: '550453', specialtyRatings: [] }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })

  it('credential with blank agencyID must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '', specialtyRatings: ['OW', 'AOW'] }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })

  it('valid credential with empty specialtyRatings passes completeness', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '550453', specialtyRatings: [] }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      expect(result.incomplete).not.toContain('credential')
    })
  })

  it('credential with blank agency/level/agencyID must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: '', level: '', agencyID: '', specialtyRatings: ['OW'] }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      // A credential with all blank inner fields should not count as complete
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })
})

// ─── HIGH: DiveCenter associations hollow-array bypass ──────────────────────

describe('prerequisite gate: DiveCenter — associations depth', () => {
  it('association with blank agency and number must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId, {
        associations: [{ agency: '', number: '' }],
        customerLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')
      // A hollow association should not count as complete
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('associations')
    })
  })

  it('association with blank number only must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId, {
        associations: [{ agency: 'PADI', number: '' }],
        customerLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('associations')
    })
  })

  it('association missing selectedSpecialties fails safe instead of counting as complete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId, {
        associations: [{ agency: 'PADI', number: '12345' }],
        customerLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('associations')
    })
  })
})

// ─── HIGH: Agent associations hollow-array bypass ───────────────────────────

describe('prerequisite gate: Agent — associations depth', () => {
  it('association with blank agency and number must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Agent' })
      await ctx.db.patch(userId, {
        phone: '+66123456789',
        appLanguage: 'en',
        customerLanguages: ['en-GB'],
      })
      await seedAgent(ctx, userId, {
        associations: [{ agency: '', number: '' }],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Agent')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('associations')
    })
  })
})

// ─── HIGH: DM-credential Instructor hollow-array bypass ────────────────────────

describe('prerequisite gate: Instructor w/ DM credential — credential depth', () => {
  it('credential with blank agency/level/agencyID must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      const organizationId = await getOrCreateTestOrg(ctx as SeedCtx, userId, 'Test DM')
      await ctx.db.insert('diveStaff', {
        userId,
        organizationId,
        role: 'Instructor',
        name: 'Test DM',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.0957,
        lng: 99.8408,
        email: 'dm@test.com',
        phone: '+66123456789',
        credential: [{ agency: '', level: '', agencyID: '' }],
        verified: true,
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })
})

// ─── HIGH: Boat fleet depth — inner fields unchecked ────────────────────────

describe('prerequisite gate: Boat — fleet depth', () => {
  it('fleet entry with blank boatName must make completeness < 100%', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      const organizationId = await getOrCreateTestOrg(ctx as SeedCtx, userId, 'Test Boat Biz')
      await ctx.db.insert('boats', {
        userId,
        organizationId,
        name: 'Test Boat Biz',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.0957,
        lng: 99.8408,
        email: 'boat@test.com',
        phone: '+66123456789',
        fleet: [{
          boatName: '',
          maxPax: 0,
          boatType: 'day_boat' as const,
          routes: [{ diveSite: 'Sail Rock', daysOfWeek: [1, 2, 3, 4, 5] }],
        }],
        hasCompressor: false,
        verified: true,
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Boat')
      // Fleet entry with blank boatName and maxPax 0 should not pass
      expect(result.percentage).toBeLessThan(100)
    })
  })
})
