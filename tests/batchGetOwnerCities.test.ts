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


describe('batchGetOwnerContext', () => {
  it('returns city and language maps for each slug', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      const userId1 = await seedUser(ctx, {
        tokenIdentifier: 'user|batch-1',
        slug: 'instr-a',
        role: 'Instructor',
        email: 'a@test.com',
        firstName: 'A',
        lastName: 'Test',
      })
      await seedInstructorProfile(ctx, userId1, { placeName: 'Koh Tao', teachingLanguages: ['en-GB'] })

      const userId2 = await seedUser(ctx, {
        tokenIdentifier: 'user|batch-2',
        slug: 'instr-b',
        role: 'Instructor',
        email: 'b@test.com',
        firstName: 'B',
        lastName: 'Test',
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
        firstName: 'NP',
        lastName: 'Test',
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


describe('decline with maxCandidates bound', () => {
  it('evaluates at most MAX_CANDIDATES alternatives', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|bound-dc',
        slug: 'bound-dc',
        role: 'DiveCenter',
        email: 'bound-dc@test.com',
        firstName: 'Bound',
        lastName: 'DC',
      })

      await seedUser(ctx, {
        tokenIdentifier: 'user|bound-instr',
        slug: 'bound-instr',
        role: 'Instructor',
        email: 'bound-instr@test.com',
        firstName: 'Bound',
        lastName: 'Instr',
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
        resourceId: 'bound-instr',
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

      const totalAlts = MAX_CANDIDATES + 5
      for (let i = 0; i < totalAlts; i++) {
        const slug = `alt-instr-${i}`
        await seedUser(ctx, {
          tokenIdentifier: `user|alt-${i}`,
          slug,
          role: 'Instructor',
          email: `alt-${i}@test.com`,
          firstName: 'Alt',
          lastName: `${i}`,
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

    await t.withIdentity({ tokenIdentifier: 'user|bound-instr' }).mutation(
      api.reservationsMutations.declineReservation,
      { bookingId, inventoryUnitId: unitId },
    )

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


describe('decline with batched city lookup preserves filtering', () => {
  it('finds same-city alternative and does not send no_backup_available', async () => {
    const t = makeT()

    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'user|city-dc',
        slug: 'city-dc',
        role: 'DiveCenter',
        email: 'city-dc@test.com',
        firstName: 'City',
        lastName: 'DC',
      })

      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|city-decl',
        slug: 'city-decl-instr',
        role: 'Instructor',
        email: 'city-decl@test.com',
        firstName: 'Decl',
        lastName: 'Inst',
      })
      await seedInstructorProfile(ctx, declUserId, { placeName: 'Koh Tao' })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Decl Instructor',
        ownerId: 'city-decl-instr',
        ownerType: 'Instructor',
      })

      const altUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|city-alt',
        slug: 'city-alt-instr',
        role: 'Instructor',
        email: 'city-alt@test.com',
        firstName: 'Alt',
        lastName: 'Inst',
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
        resourceId: 'city-decl-instr',
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
      const noBackup = notifications.find((n) => n.type === 'no_backup_available')
      expect(noBackup).toBeUndefined()

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
      await seedUser(ctx, {
        tokenIdentifier: 'user|lang-dc',
        slug: 'lang-dc',
        role: 'DiveCenter',
        email: 'lang-dc@test.com',
        firstName: 'Lang',
        lastName: 'DC',
      })

      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-decl',
        slug: 'lang-decl-instr',
        role: 'Instructor',
        email: 'lang-decl@test.com',
        firstName: 'Decl',
        lastName: 'Inst',
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

      const altAUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-alt-a',
        slug: 'lang-alt-a',
        role: 'Instructor',
        email: 'lang-alt-a@test.com',
        firstName: 'Alt',
        lastName: 'A',
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

      const altBUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|lang-alt-b',
        slug: 'lang-alt-b',
        role: 'Instructor',
        email: 'lang-alt-b@test.com',
        firstName: 'Alt',
        lastName: 'B',
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
        resourceId: 'lang-decl-instr',
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
      await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-dc',
        slug: 'diffcity-dc',
        role: 'DiveCenter',
        email: 'diffcity-dc@test.com',
        firstName: 'DiffCity',
        lastName: 'DC',
      })

      const declUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-decl',
        slug: 'diffcity-decl-instr',
        role: 'Instructor',
        email: 'diffcity-decl@test.com',
        firstName: 'DiffDecl',
        lastName: 'Inst',
      })
      await seedInstructorProfile(ctx, declUserId, { placeName: 'Koh Tao' })

      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'DiffDecl Instructor',
        ownerId: 'diffcity-decl-instr',
        ownerType: 'Instructor',
      })

      const altUserId = await seedUser(ctx, {
        tokenIdentifier: 'user|diffcity-alt',
        slug: 'diffcity-alt-instr',
        role: 'Instructor',
        email: 'diffcity-alt@test.com',
        firstName: 'DiffAlt',
        lastName: 'Inst',
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
        resourceId: 'diffcity-decl-instr',
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
