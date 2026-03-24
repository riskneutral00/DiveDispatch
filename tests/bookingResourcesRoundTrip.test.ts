/**
 * Booking Resources Round-Trip Integration Test
 *
 * Tests the full lifecycle through the bookingResources junction table:
 * 1. Setup: seed operator, instructor, equipment manager
 * 2. Create Draft booking, submit with sessions + resources
 * 3. Verify stakeholders via getBookingDetail
 * 4. Verify open requests via getOpenRequests
 * 5. Accept instructor reservation -> Confirmed
 * 6. Accept equipment reservation -> auto-advance to Upcoming
 * 7. Decline flow: second booking, accept instructor, decline equipment -> cascade
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { HOLD_TTL_MS as HOLD_TTL } from '../convex/lib/auth'
import { testDate } from './helpers/dates'
import { seedUser, type SeedCtx } from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: testDate(5),
        endDate: testDate(7),
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    ...(overrides as Record<string, unknown>),
  })
}

async function seedInstructorUnit(ctx: SeedCtx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Instructor',
    resourceId: ownerId,
    displayName: `Instructor unit for ${ownerId}`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Instructor',
  })
}

async function seedEquipmentUnit(ctx: SeedCtx, ownerId: string): Promise<Id<'inventoryUnits'>> {
  return ctx.db.insert('inventoryUnits', {
    resourceType: 'Equipment',
    resourceId: ownerId,
    displayName: `Equipment for ${ownerId}`,
    capacityModel: 'Exclusive',
    totalUnits: 1,
    ownerId,
    ownerType: 'Equipment',
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bookingResources round-trip lifecycle', () => {
  // ── Setup + submitToDraft ─────────────────────────────────────────────────

  describe('Phase 1: submitToDraft creates junction rows + reservations', () => {
    it('creates bookingResources rows and PendingAcceptance reservations for both resources', async () => {
      const t = makeT()

      // Seed 3 users: operator, instructor, equipment manager
      const { bookingId, instUnitId, emUnitId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
        await seedUser(ctx, { slug: 'inst-1', tokenIdentifier: 'clerk|inst-1', role: 'Instructor' })
        await seedUser(ctx, { slug: 'em-1', tokenIdentifier: 'clerk|em-1', role: 'Equipment' })

        const instUnitId = await seedInstructorUnit(ctx, 'inst-1')
        const emUnitId = await seedEquipmentUnit(ctx, 'em-1')

        const bookingId = await seedBooking(ctx, 'dc-test', {
          customerFormComplete: true,
        })

        return { bookingId, instUnitId, emUnitId }
      })

      // Call submitToDraft with sessions for both units + bookingData.resources
      await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: instUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: emUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
          bookingData: {
            activityType: ['OW'],
            startDate: testDate(5),
            endDate: testDate(7),
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            divers: [
              {
                name: 'Alice',
                abbrev: 'A',
                flag: { code: 'TH', label: 'Thailand' },
                startDate: testDate(5),
                endDate: testDate(7),
                activityType: ['OW'],
              },
            ],
            resources: [
              { resourceType: 'Instructor', resourceSlug: 'inst-1' },
              { resourceType: 'Equipment', resourceSlug: 'em-1' },
            ],
          },
        },
      )

      // Verify bookingResources junction table has both rows
      await t.run(async (ctx) => {
        const brRows = await ctx.db
          .query('bookingResources')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        expect(brRows).toHaveLength(2)

        const types = brRows.map((r) => r.resourceType).sort()
        expect(types).toEqual(['Equipment', 'Instructor'])

        const instRow = brRows.find((r) => r.resourceType === 'Instructor')
        expect(instRow!.resourceSlug).toBe('inst-1')

        const emRow = brRows.find((r) => r.resourceType === 'Equipment')
        expect(emRow!.resourceSlug).toBe('em-1')
      })

      // Verify reservations created as PendingAcceptance
      await t.run(async (ctx) => {
        const reservations = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        expect(reservations).toHaveLength(2)
        expect(reservations.every((r) => r.status === 'PendingAcceptance')).toBe(true)
      })
    })
  })

  // ── getBookingDetail stakeholders ─────────────────────────────────────────

  describe('Phase 2: getBookingDetail returns stakeholders from junction table', () => {
    it('stakeholders array includes both resources with correct names and reservationStatus', async () => {
      const t = makeT()

      const { bookingId, instUnitId, emUnitId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
        await seedUser(ctx, { slug: 'inst-1', tokenIdentifier: 'clerk|inst-1', role: 'Instructor', name: 'inst-1 Display' })
        await seedUser(ctx, { slug: 'em-1', tokenIdentifier: 'clerk|em-1', role: 'Equipment', name: 'em-1 Display' })

        const instUnitId = await seedInstructorUnit(ctx, 'inst-1')
        const emUnitId = await seedEquipmentUnit(ctx, 'em-1')

        const bookingId = await seedBooking(ctx, 'dc-test', {
          customerFormComplete: true,
        })

        return { bookingId, instUnitId, emUnitId }
      })

      await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: instUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: emUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
          bookingData: {
            activityType: ['OW'],
            startDate: testDate(5),
            endDate: testDate(7),
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            divers: [
              {
                name: 'Alice',
                abbrev: 'A',
                flag: { code: 'TH', label: 'Thailand' },
                startDate: testDate(5),
                endDate: testDate(7),
                activityType: ['OW'],
              },
            ],
            resources: [
              { resourceType: 'Instructor', resourceSlug: 'inst-1' },
              { resourceType: 'Equipment', resourceSlug: 'em-1' },
            ],
          },
        },
      )

      const detail = await t
        .withIdentity({ tokenIdentifier: 'clerk|dc-test' })
        .query(api.bookings.getBookingDetail, { bookingId: bookingId as never })

      expect(detail).not.toBeNull()
      expect(detail!.stakeholders).toHaveLength(2)

      const instStakeholder = detail!.stakeholders.find((s) => s.role === 'Instructor')
      expect(instStakeholder).toBeDefined()
      expect(instStakeholder!.slug).toBe('inst-1')
      expect(instStakeholder!.name).toBe('inst-1 Display')
      expect(instStakeholder!.isExternal).toBe(false)
      expect(instStakeholder!.reservationStatus).toBe('PendingAcceptance')

      const emStakeholder = detail!.stakeholders.find((s) => s.role === 'Equipment')
      expect(emStakeholder).toBeDefined()
      expect(emStakeholder!.slug).toBe('em-1')
      expect(emStakeholder!.name).toBe('em-1 Display')
      expect(emStakeholder!.isExternal).toBe(false)
      expect(emStakeholder!.reservationStatus).toBe('PendingAcceptance')
    })
  })

  // ── getOpenRequests ───────────────────────────────────────────────────────

  describe('Phase 3: getOpenRequests surfaces pending reservations', () => {
    it('instructor sees booking in their open requests', async () => {
      const t = makeT()

      const { bookingId, instUnitId, emUnitId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
        await seedUser(ctx, { slug: 'inst-1', tokenIdentifier: 'clerk|inst-1', role: 'Instructor' })
        await seedUser(ctx, { slug: 'em-1', tokenIdentifier: 'clerk|em-1', role: 'Equipment' })

        const instUnitId = await seedInstructorUnit(ctx, 'inst-1')
        const emUnitId = await seedEquipmentUnit(ctx, 'em-1')

        const bookingId = await seedBooking(ctx, 'dc-test', {
          customerFormComplete: true,
        })

        return { bookingId, instUnitId, emUnitId }
      })

      await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: instUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: emUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
          bookingData: {
            activityType: ['OW'],
            startDate: testDate(5),
            endDate: testDate(7),
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            divers: [
              {
                name: 'Alice',
                abbrev: 'A',
                flag: { code: 'TH', label: 'Thailand' },
                startDate: testDate(5),
                endDate: testDate(7),
                activityType: ['OW'],
              },
            ],
            resources: [
              { resourceType: 'Instructor', resourceSlug: 'inst-1' },
              { resourceType: 'Equipment', resourceSlug: 'em-1' },
            ],
          },
        },
      )

      // Instructor should see this in their open requests
      const openRequests = await t
        .withIdentity({ tokenIdentifier: 'clerk|inst-1' })
        .query(api.resourceQueries.getOpenRequests)

      expect(openRequests).toHaveLength(1)
      expect(openRequests[0].bookingId).toBe(bookingId)
      expect(openRequests[0].operatorName).toBe('Test DC')
    })
  })

  // ── Accept flow -> auto-advance ───────────────────────────────────────────

  describe('Phase 4: accept both reservations -> auto-advance to Upcoming', () => {
    it('accepting instructor then equipment triggers auto-advance', async () => {
      const t = makeT()

      const { bookingId, instUnitId, emUnitId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
        await seedUser(ctx, { slug: 'inst-1', tokenIdentifier: 'clerk|inst-1', role: 'Instructor' })
        await seedUser(ctx, { slug: 'em-1', tokenIdentifier: 'clerk|em-1', role: 'Equipment' })

        const instUnitId = await seedInstructorUnit(ctx, 'inst-1')
        const emUnitId = await seedEquipmentUnit(ctx, 'em-1')

        const bookingId = await seedBooking(ctx, 'dc-test', {
          customerFormComplete: true,
        })

        return { bookingId, instUnitId, emUnitId }
      })

      await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: instUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: emUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
          bookingData: {
            activityType: ['OW'],
            startDate: testDate(5),
            endDate: testDate(7),
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            divers: [
              {
                name: 'Alice',
                abbrev: 'A',
                flag: { code: 'TH', label: 'Thailand' },
                startDate: testDate(5),
                endDate: testDate(7),
                activityType: ['OW'],
              },
            ],
            resources: [
              { resourceType: 'Instructor', resourceSlug: 'inst-1' },
              { resourceType: 'Equipment', resourceSlug: 'em-1' },
            ],
          },
        },
      )

      // Find the instructor reservation
      const instResId = await t.run(async (ctx) => {
        const reservations = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        const instRes = reservations.find((r) => r.inventoryUnitId === instUnitId)
        return instRes!._id
      })

      // Accept instructor reservation
      await t.withIdentity({ tokenIdentifier: 'clerk|inst-1' }).mutation(
        api.reservationsMutations.acceptReservation,
        { reservationId: instResId },
      )

      // Verify instructor reservation is Confirmed, booking still Draft
      await t.run(async (ctx) => {
        const res = await ctx.db.get(instResId)
        expect(res!.status).toBe('Confirmed')

        const booking = await ctx.db.get(bookingId)
        expect(booking!.status).toBe('Draft') // still Draft — EM not yet accepted
      })

      // Find the equipment reservation
      const emResId = await t.run(async (ctx) => {
        const reservations = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        const emRes = reservations.find((r) => r.inventoryUnitId === emUnitId)
        return emRes!._id
      })

      // Accept equipment reservation — this should trigger auto-advance
      await t.withIdentity({ tokenIdentifier: 'clerk|em-1' }).mutation(
        api.reservationsMutations.acceptReservation,
        { reservationId: emResId },
      )

      // Verify booking is now Upcoming (both confirmed + customerFormComplete + bookingFormComplete)
      await t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId)
        expect(booking!.status).toBe('Upcoming')

        const emRes = await ctx.db.get(emResId)
        expect(emRes!.status).toBe('Confirmed')
      })
    })
  })

  // ── Decline flow ──────────────────────────────────────────────────────────

  describe('Phase 5: decline flow — equipment decline cascades correctly', () => {
    it('declining equipment vacates reservations, deletes junction row, restores snapshot', async () => {
      const t = makeT()

      const { bookingId, instUnitId, emUnitId } = await t.run(async (ctx) => {
        await seedUser(ctx, { slug: 'dc-test', tokenIdentifier: 'clerk|dc-test', role: 'DiveCenter' })
        await seedUser(ctx, { slug: 'inst-1', tokenIdentifier: 'clerk|inst-1', role: 'Instructor' })
        await seedUser(ctx, { slug: 'em-1', tokenIdentifier: 'clerk|em-1', role: 'Equipment' })

        const instUnitId = await seedInstructorUnit(ctx, 'inst-1')
        const emUnitId = await seedEquipmentUnit(ctx, 'em-1')

        const bookingId = await seedBooking(ctx, 'dc-test', {
          customerFormComplete: true,
        })

        return { bookingId, instUnitId, emUnitId }
      })

      await t.withIdentity({ tokenIdentifier: 'clerk|dc-test' }).mutation(
        api.bookings.create.submitToDraft,
        {
          bookingId,
          sessions: [
            {
              inventoryUnitId: instUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
            {
              inventoryUnitId: emUnitId,
              date: testDate(5),
              startTime: '08:00',
              endTime: '17:00',
              timezone: 'Asia/Bangkok',
              unitsRequested: 1,
            },
          ],
          bookingData: {
            activityType: ['OW'],
            startDate: testDate(5),
            endDate: testDate(7),
            portalContact: false,
            portalMedical: false,
            portalWaiver: false,
            divers: [
              {
                name: 'Alice',
                abbrev: 'A',
                flag: { code: 'TH', label: 'Thailand' },
                startDate: testDate(5),
                endDate: testDate(7),
                activityType: ['OW'],
              },
            ],
            resources: [
              { resourceType: 'Instructor', resourceSlug: 'inst-1' },
              { resourceType: 'Equipment', resourceSlug: 'em-1' },
            ],
          },
        },
      )

      // Accept instructor reservation first
      const instResId = await t.run(async (ctx) => {
        const reservations = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        return reservations.find((r) => r.inventoryUnitId === instUnitId)!._id
      })

      await t.withIdentity({ tokenIdentifier: 'clerk|inst-1' }).mutation(
        api.reservationsMutations.acceptReservation,
        { reservationId: instResId },
      )

      // Verify snapshot was created for equipment unit (reservedUnits=1, availableUnits=0)
      const emSnapshotBefore = await t.run(async (ctx) => {
        const snap = await ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
            q.eq('inventoryUnitId', emUnitId).eq('date', testDate(5)).eq('windowStart', '08:00'),
          )
          .unique()
        return snap
      })
      expect(emSnapshotBefore).not.toBeNull()
      expect(emSnapshotBefore!.reservedUnits).toBe(1)
      expect(emSnapshotBefore!.availableUnits).toBe(0)

      // Decline equipment reservation
      await t.withIdentity({ tokenIdentifier: 'clerk|em-1' }).mutation(
        api.reservationsMutations.declineReservation,
        { bookingId: bookingId as never, inventoryUnitId: emUnitId as never },
      )

      // Verify: equipment reservation is Vacated with stakeholder_declined
      await t.run(async (ctx) => {
        const reservations = await ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        const emRes = reservations.find((r) => r.inventoryUnitId === emUnitId)
        expect(emRes!.status).toBe('Vacated')
        expect(emRes!.vacatedBy).toBe('stakeholder_declined')
      })

      // Verify: Equipment bookingResources row is deleted
      await t.run(async (ctx) => {
        const brRows = await ctx.db
          .query('bookingResources')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect()
        const emRow = brRows.find((r) => r.resourceType === 'Equipment')
        expect(emRow).toBeUndefined()

        // Instructor row should still exist
        const instRow = brRows.find((r) => r.resourceType === 'Instructor')
        expect(instRow).toBeDefined()
        expect(instRow!.resourceSlug).toBe('inst-1')
      })

      // Verify: availability snapshot for equipment unit is restored
      const emSnapshotAfter = await t.run(async (ctx) => {
        return ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
            q.eq('inventoryUnitId', emUnitId).eq('date', testDate(5)).eq('windowStart', '08:00'),
          )
          .unique()
      })
      expect(emSnapshotAfter).not.toBeNull()
      expect(emSnapshotAfter!.reservedUnits).toBe(0)
      expect(emSnapshotAfter!.availableUnits).toBe(1)

      // Verify: booking stays Draft (decline does not cascade Draft -> anything else;
      // it only cascades Upcoming -> Draft)
      const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
      expect(booking!.status).toBe('Draft')

      // Verify: notification was sent to booking owner
      await t.run(async (ctx) => {
        const notifications = await ctx.db
          .query('notifications')
          .withIndex('by_userId', (q) => q.eq('userId', 'dc-test'))
          .collect()
        const declineNotif = notifications.find((n) => n.type === 'hold_declined')
        expect(declineNotif).toBeDefined()
        expect(declineNotif!.bookingId).toBe(bookingId)
      })
    })
  })
})
