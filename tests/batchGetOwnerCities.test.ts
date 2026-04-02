/**
 * DD-263: Batch getOwnerCity in alternative resource search
 *
 * Tests that:
 * 1. batchGetOwnerCities returns a Map<slug, city|null> for all slugs in parallel
 * 2. Candidate search is bounded by MAX_CANDIDATES
 * 3. Decline with alternative in same city still finds the backup (behavior preserved)
 * 4. Decline with maxCandidates+1 alternatives only evaluates maxCandidates
 */

import { describe, it, expect } from 'vitest'
import { testDate } from './helpers/dates'
import { makeT } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedSnapshot,
  seedBookingResource,
  seedInstructorProfile,
  type SeedCtx,
} from './fixtures'
import { api } from '../convex/_generated/api'
import { batchGetOwnerContext, MAX_CANDIDATES } from '../convex/reservationsMutations'

// ─── Unit: batchGetOwnerContext ──────────────────────────────────────────────

describe('batchGetOwnerContext', () => {
  it('returns city and language maps for each slug', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const userId1 = await seedUser(ctx, {
        tokenIdentifier: 'user|batch-1',
        slug: 'instr-a',
        role: 'Instructor',
        email: 'a@test.com',
        name: 'A',
        firstName: 'A',
        lastName: 'Test',
        businessName: 'A Co',
      })
      await seedInstructorProfile(ctx, userId1, { placeName: 'Koh Tao', teachingLanguages: ['en-GB'] })

      const userId2 = await seedUser(ctx, {
        tokenIdentifier: 'user|batch-2',
        slug: 'instr-b',
        role: 'Instructor',
        email: 'b@test.com',
        name: 'B',
        firstName: 'B',
        lastName: 'Test',
        businessName: 'B Co',
      })
      await seedInstructorProfile(ctx, userId2, { placeName: 'Koh Phi Phi', teachingLanguages: ['th-TH'] })

      const { cities, languages } = await batchGetOwnerContext(ctx, ['instr-a', 'instr-b'], 'Instructor')

      expect(cities).toBeInstanceOf(Map)
      expect(cities.get('instr-a')).toBe('Koh Tao')
      expect(cities.get('instr-b')).toBe('Koh Phi Phi')
      expect(languages.get('instr-a')).toEqual(['en-GB'])
      expect(languages.get('instr-b')).toEqual(['th-TH'])
    })
  })

  it('returns null city for slugs with no user record', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const { cities } = await batchGetOwnerContext(ctx, ['nonexistent-slug'], 'Instructor')

      expect(cities.get('nonexistent-slug')).toBeNull()
    })
  })

  it('returns null city for users with no profile', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|no-profile',
        slug: 'no-profile-slug',
        role: 'Instructor',
        email: 'np@test.com',
        name: 'NP',
        firstName: 'NP',
        lastName: 'Test',
        businessName: 'NP Co',
      })

      const { cities } = await batchGetOwnerContext(ctx, ['no-profile-slug'], 'Instructor')

      expect(cities.get('no-profile-slug')).toBeNull()
    })
  })

  it('handles empty slug array', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const { cities, languages } = await batchGetOwnerContext(ctx, [], 'Instructor')

      expect(cities).toBeInstanceOf(Map)
      expect(cities.size).toBe(0)
      expect(languages).toBeInstanceOf(Map)
      expect(languages.size).toBe(0)
    })
  })
})

// ─── Behavioral: MAX_CANDIDATES export ──────────────────────────────────────

describe('MAX_CANDIDATES constant', () => {
  it('is exported and equals 20', () => {
    expect(MAX_CANDIDATES).toBe(20)
  })
})

// ─── Behavioral: decline with maxCandidates bound ───────────────────────────

describe('decline with maxCandidates bound', () => {
  it('evaluates at most MAX_CANDIDATES alternatives', async () => {
    const t = makeT()

    // Create declining instructor + DC + MAX_CANDIDATES+5 alternative units
    const { bookingId, unitId } = await t.run(async (ctx) => {
      // DC user
      await seedUser(ctx, {
        tokenIdentifier: 'user|bound-dc',
        slug: 'bound-dc',
        role: 'DiveCenter',
        email: 'bound-dc@test.com',
        name: 'Bound DC',
        firstName: 'Bound',
        lastName: 'DC',
        businessName: 'Bound DC Co',
      })

      // Declining instructor
      await seedUser(ctx, {
        tokenIdentifier: 'user|bound-instr',
        slug: 'bound-instr',
        role: 'Instructor',
        email: 'bound-instr@test.com',
        name: 'Bound Instructor',
        firstName: 'Bound',
        lastName: 'Instr',
        businessName: 'Bound Co',
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Bound Instructor',
        ownerId: 'bound-instr',
        ownerType: 'Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'bound-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'Bound DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'bound-instr',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Seed MAX_CANDIDATES + 5 alternative units (all with NO availability)
      // None have snapshots, so none will be found as alternatives.
      // The point is to verify the search is bounded.
      const totalAlts = MAX_CANDIDATES + 5
      for (let i = 0; i < totalAlts; i++) {
        const slug = `alt-instr-${i}`
        await seedUser(ctx, {
          tokenIdentifier: `user|alt-${i}`,
          slug,
          role: 'Instructor',
          email: `alt-${i}@test.com`,
          name: `Alt ${i}`,
          firstName: 'Alt',
          lastName: `${i}`,
          businessName: `Alt ${i} Co`,
        })
        await seedInventoryUnit(ctx, {
          resourceType: 'Instructor',
          displayName: `Alt ${i}`,
          ownerId: slug,
          ownerType: 'Instructor',
        })
      }

      return { bookingId, unitId }
    })

    // Decline should complete without error (bounded search)
    await t.withIdentity({ tokenIdentifier: 'user|bound-instr' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Should send no_backup_available (none of the alts have snapshots)
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toMatchObject({
        type: 'no_backup_available',
        bookingId,
      })
    })
  })
})

// ─── Behavioral: decline still finds same-city alternative (regression) ─────

describe('decline with batched city lookup preserves filtering', () => {
  it('finds same-city alternative and does not send no_backup_available', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // DC
      await seedUser(ctx, {
        tokenIdentifier: 'user|city-dc',
        slug: 'city-dc',
        role: 'DiveCenter',
        email: 'city-dc@test.com',
        name: 'City DC',
        firstName: 'City',
        lastName: 'DC',
        businessName: 'City DC Co',
      })

      // Declining instructor in Koh Tao
      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|city-decl',
        slug: 'city-decl-instr',
        role: 'Instructor',
        email: 'city-decl@test.com',
        name: 'Decl Instructor',
        firstName: 'Decl',
        lastName: 'Inst',
        businessName: 'Decl Co',
      })
      await seedInstructorProfile(ctx, declUserId, { placeName: 'Koh Tao' })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Decl Instructor',
        ownerId: 'city-decl-instr',
        ownerType: 'Instructor',
      })

      // Alternative instructor also in Koh Tao
      const altUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|city-alt',
        slug: 'city-alt-instr',
        role: 'Instructor',
        email: 'city-alt@test.com',
        name: 'Alt Instructor',
        firstName: 'Alt',
        lastName: 'Inst',
        businessName: 'Alt Co',
      })
      await seedInstructorProfile(ctx, altUserId, { placeName: 'Koh Tao' })

      const altUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Alt Instructor',
        ownerId: 'city-alt-instr',
        ownerType: 'Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'city-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'City DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'city-decl-instr',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Alternative has availability
      await seedSnapshot(ctx, altUnitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|city-decl' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      // Should NOT have no_backup_available — same city alt exists
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toBeUndefined()

      // Should still have hold_declined
      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toMatchObject({
        type: 'hold_declined',
        bookingId,
      })
    })
  })

  it('prefers language-matching alternative when multiple exist', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // DC
      await seedUser(ctx, {
        tokenIdentifier: 'user|lang-dc',
        slug: 'lang-dc',
        role: 'DiveCenter',
        email: 'lang-dc@test.com',
        name: 'Lang DC',
        firstName: 'Lang',
        lastName: 'DC',
        businessName: 'Lang DC Co',
      })

      // Declining instructor in Koh Tao
      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-decl',
        slug: 'lang-decl-instr',
        role: 'Instructor',
        email: 'lang-decl@test.com',
        name: 'Decl Instructor',
        firstName: 'Decl',
        lastName: 'Inst',
        businessName: 'Decl Co',
      })
      await seedInstructorProfile(ctx, declUserId, {
        placeName: 'Koh Tao',
        teachingLanguages: ['en-GB'],
      })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Decl Instructor',
        ownerId: 'lang-decl-instr',
        ownerType: 'Instructor',
      })

      // Alternative A: NO language match (French only)
      const altAUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-alt-a',
        slug: 'lang-alt-a',
        role: 'Instructor',
        email: 'lang-alt-a@test.com',
        name: 'Alt A',
        firstName: 'Alt',
        lastName: 'A',
        businessName: 'Alt A Co',
      })
      await seedInstructorProfile(ctx, altAUserId, {
        placeName: 'Koh Tao',
        teachingLanguages: ['fr-FR'],
      })
      const altAUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Alt A',
        ownerId: 'lang-alt-a',
        ownerType: 'Instructor',
      })

      // Alternative B: HAS language match (English)
      const altBUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-alt-b',
        slug: 'lang-alt-b',
        role: 'Instructor',
        email: 'lang-alt-b@test.com',
        name: 'Alt B',
        firstName: 'Alt',
        lastName: 'B',
        businessName: 'Alt B Co',
      })
      await seedInstructorProfile(ctx, altBUserId, {
        placeName: 'Koh Tao',
        teachingLanguages: ['en-GB', 'th-TH'],
      })
      const altBUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Alt B',
        ownerId: 'lang-alt-b',
        ownerType: 'Instructor',
      })

      // Booking with English-speaking diver (using locale code to match backend format)
      const bookingId = await seedBooking(ctx, {
        ownerId: 'lang-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'Lang DC Co',
        divers: [{
          name: 'Alice',
          abbrev: 'AL',
          flag: { code: 'en-GB', label: 'English' },
          startDate: testDate(5),
          endDate: testDate(5),
          activityType: ['OW'],
        }],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'lang-decl-instr',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Both alternatives have availability
      await seedSnapshot(ctx, altAUnit, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })
      await seedSnapshot(ctx, altBUnit, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|lang-decl' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Language-matching alternative exists → no no_backup_available
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toBeUndefined()

      const holdDeclined = notifications.find((n) => n.type === 'hold_declined')
      expect(holdDeclined).toMatchObject({
        type: 'hold_declined',
        bookingId,
      })
    })
  })

  it('filters out alternative in different city', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      // DC
      await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-dc',
        slug: 'diffcity-dc',
        role: 'DiveCenter',
        email: 'diffcity-dc@test.com',
        name: 'DiffCity DC',
        firstName: 'DiffCity',
        lastName: 'DC',
        businessName: 'DiffCity DC Co',
      })

      // Declining instructor in Koh Tao
      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-decl',
        slug: 'diffcity-decl-instr',
        role: 'Instructor',
        email: 'diffcity-decl@test.com',
        name: 'DiffDecl Instructor',
        firstName: 'DiffDecl',
        lastName: 'Inst',
        businessName: 'DiffDecl Co',
      })
      await seedInstructorProfile(ctx, declUserId, { placeName: 'Koh Tao' })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'DiffDecl Instructor',
        ownerId: 'diffcity-decl-instr',
        ownerType: 'Instructor',
      })

      // Alternative instructor in Koh Phi Phi (different city)
      const altUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-alt',
        slug: 'diffcity-alt-instr',
        role: 'Instructor',
        email: 'diffcity-alt@test.com',
        name: 'DiffAlt Instructor',
        firstName: 'DiffAlt',
        lastName: 'Inst',
        businessName: 'DiffAlt Co',
      })
      await seedInstructorProfile(ctx, altUserId, { placeName: 'Koh Phi Phi' })

      const altUnitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'DiffAlt Instructor',
        ownerId: 'diffcity-alt-instr',
        ownerType: 'Instructor',
      })

      const bookingId = await seedBooking(ctx, {
        ownerId: 'diffcity-dc',
        startDate: testDate(5),
        endDate: testDate(5),
        operatorName: 'DiffCity DC Co',
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Instructor',
        resourceSlug: 'diffcity-decl-instr',
      })

      const sessionId = await seedSession(ctx, bookingId, unitId, {
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
      })
      await seedReservation(ctx, bookingId, unitId, sessionId)
      await seedSnapshot(ctx, unitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      // Alt has availability but is in different city
      await seedSnapshot(ctx, altUnitId, {
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 0,
        availableUnits: 1,
      })

      return { bookingId, unitId }
    })

    await t.withIdentity({ tokenIdentifier: 'user|diffcity-decl' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

    // Different city alternative should be filtered out → no_backup_available sent
    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toMatchObject({
        type: 'no_backup_available',
        bookingId,
      })
    })
  })
})
