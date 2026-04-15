import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  assertSnapshotImmutability,
  BOOKINGS_SNAPSHOT_FIELDS,
  BOOKING_LINKS_SNAPSHOT_FIELDS,
} from '../convex/lib/snapshotFields'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { testDate } from './helpers/dates'
import { seedUser, seedBooking, seedInventoryUnit } from './fixtures'

describe('assertSnapshotImmutability — unit', () => {
  it('no-op when patch omits the snapshot fields', () => {
    const existing = { operatorName: 'Op A', startDate: '2026-05-01', endDate: '2026-05-03' }
    expect(() =>
      assertSnapshotImmutability(existing, { submittedAt: 1 }, BOOKINGS_SNAPSHOT_FIELDS),
    ).not.toThrow()
  })

  it('no-op when patch values equal existing values', () => {
    const existing = { operatorName: 'Op A', startDate: '2026-05-01', endDate: '2026-05-03' }
    expect(() =>
      assertSnapshotImmutability(
        existing,
        { operatorName: 'Op A', startDate: '2026-05-01', endDate: '2026-05-03' },
        BOOKINGS_SNAPSHOT_FIELDS,
      ),
    ).not.toThrow()
  })

  it.each(BOOKINGS_SNAPSHOT_FIELDS)('throws SNAPSHOT_FIELD_IMMUTABLE on bookings.%s divergence', (field) => {
    const existing = { operatorName: 'Op A', startDate: '2026-05-01', endDate: '2026-05-03' }
    try {
      assertSnapshotImmutability(existing, { [field]: 'DIFFERENT' }, BOOKINGS_SNAPSHOT_FIELDS)
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; field: string }>).data
      expect(data.code).toBe('SNAPSHOT_FIELD_IMMUTABLE')
      expect(data.field).toBe(field)
    }
  })

  it.each(BOOKING_LINKS_SNAPSHOT_FIELDS)('throws SNAPSHOT_FIELD_IMMUTABLE on bookingLinks.%s divergence', (field) => {
    const existing = { customerName: 'Alice', email: 'alice@test.com' }
    try {
      assertSnapshotImmutability(existing, { [field]: 'DIFFERENT' }, BOOKING_LINKS_SNAPSHOT_FIELDS)
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; field: string }>).data
      expect(data.code).toBe('SNAPSHOT_FIELD_IMMUTABLE')
      expect(data.field).toBe(field)
    }
  })
})

describe('submitToDraft — snapshot immutability guard', () => {
  it('rejects bookingData.startDate that differs from the booking snapshot', async () => {
    const t = makeT()
    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-snap-start', slug: 'dc-snap-start' })
      await seedUser(ctx, { tokenIdentifier: 'clerk|instr-snap-start', slug: 'instr-snap-start', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-snap-start',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
        startDate: '2026-05-01',
        endDate: '2026-05-03',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instr-snap-start',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      return { bookingId, unitId }
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-snap-start' }).mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: '2026-06-10',
          endDate: '2026-05-03',
          portalContact: true,
          portalMedical: true,
          portalWaiver: true,
          resources: [],
          divers: [],
        },
      }),
    ).rejects.toThrow(/SNAPSHOT_FIELD_IMMUTABLE/)
  })

  it('rejects bookingData.endDate that differs from the booking snapshot', async () => {
    const t = makeT()
    const { bookingId, unitId } = await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|dc-snap-end', slug: 'dc-snap-end' })
      await seedUser(ctx, { tokenIdentifier: 'clerk|instr-snap-end', slug: 'instr-snap-end', role: 'Instructor' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-snap-end',
        status: 'Draft',
        bookingFormComplete: false,
        divers: [],
        startDate: '2026-05-01',
        endDate: '2026-05-03',
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        ownerId: 'instr-snap-end',
        ownerType: 'Instructor',
        displayName: 'Instructor unit',
        capacityModel: 'Exclusive',
        totalUnits: 1,
      })
      return { bookingId, unitId }
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-snap-end' }).mutation(api.bookings.create.submitToDraft, {
        bookingId,
        sessions: [
          {
            inventoryUnitId: unitId,
            date: testDate(5),
            startTime: '09:00',
            endTime: '11:00',
            timezone: 'Asia/Bangkok',
            unitsRequested: 1,
          },
        ],
        bookingData: {
          activityType: ['OW'],
          startDate: '2026-05-01',
          endDate: '2026-06-10',
          portalContact: true,
          portalMedical: true,
          portalWaiver: true,
          resources: [],
          divers: [],
        },
      }),
    ).rejects.toThrow(/SNAPSHOT_FIELD_IMMUTABLE/)
  })
})
