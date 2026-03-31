import { describe, it, expect, beforeEach } from 'vitest'
import { checkProfileCompleteness } from '../convex/lib/profileCompleteness'
import {
  seedUser,
  seedDiveCenterProfile,
  seedInstructorProfile,
  seedBoatProfile,
  seedAgent,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── CRITICAL: Instructor credential depth (Hug Ocean bug) ─────────────────

describe('prerequisite gate: Instructor — credential depth', () => {
  it('credential with empty courses[] must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '550453', courses: [] }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })

  it('credential with 4/5 AOW specialties must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{
          agency: 'PADI',
          level: 'OWSI',
          agencyID: '550453',
          courses: ['Navigation', 'Deep', 'PPB', 'Night'], // 4/5 — missing one specialty
        }],
        teachingLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Instructor')
      // AOW requires 5 specialties — 4/5 should not pass
      expect(result.percentage).toBeLessThan(100)
    })
  })

  it('credential with blank agency/level/agencyID must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Instructor' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedInstructorProfile(ctx, userId, {
        credential: [{ agency: '', level: '', agencyID: '', courses: ['OW'] }],
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
  it('association with blank agency and number must make completeness < 100% — currently passes', async () => {
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

  it('association with empty selectedSpecialties must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveCenter' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId, {
        associations: [{
          agency: 'PADI',
          number: '12345',
          aowDays: 3,
          selectedSpecialties: [], // should have specialties selected
        }],
        customerLanguages: ['en'],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveCenter')
      // AOW days set but no specialties selected — profile should be incomplete
      expect(result.percentage).toBeLessThan(100)
    })
  })
})

// ─── HIGH: Agent associations hollow-array bypass ───────────────────────────

describe('prerequisite gate: Agent — associations depth', () => {
  it('association with blank agency and number must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Agent' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedAgent(ctx, userId, {
        associations: [{ agency: '', number: '' }],
      })

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'Agent')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('associations')
    })
  })
})

// ─── HIGH: DiveMaster credential hollow-array bypass ────────────────────────

describe('prerequisite gate: DiveMaster — credential depth', () => {
  it('credential with blank agency/level/agencyID must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'DiveMaster' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      // DiveMaster credential has no courses field
      await ctx.db.insert('diveMasters', {
        userId,
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

      const result = await checkProfileCompleteness(ctx, { _id: userId }, 'DiveMaster')
      expect(result.percentage).toBeLessThan(100)
      expect(result.incomplete).toContain('credential')
    })
  })
})

// ─── HIGH: Boat fleet depth — inner fields unchecked ────────────────────────

describe('prerequisite gate: Boat — fleet depth', () => {
  it('fleet entry with blank boatName must make completeness < 100% — currently passes', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Boat' })
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await ctx.db.insert('boats', {
        userId,
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
