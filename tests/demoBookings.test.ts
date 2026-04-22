import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

describe('demoBookings.insertDemoBatch — concrete validators', () => {
  it('rejects a bookings array whose element is missing required fields', async () => {
    const t = makeT()
    await expect(
      t.mutation(internal.demoBookings.insertDemoBatch, {
        bookings: [{} as unknown as never],
        customers: [],
        profiles: [],
        resources: [],
      }),
    ).rejects.toThrow(/[Vv]alidat/)
  })

  it('rejects bookings with invalid ownerType (outside operator union)', async () => {
    const t = makeT()
    const malformed = {
      ownerId: 'slug',
      ownerType: 'Instructor',
      status: 'Draft',
      createdAt: 0,
      holdTTL: 0,
      paid: false,
      activityType: ['DSD'],
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      divers: [],
      operatorName: 'Op',
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      medicalHardBlock: false,
      bookingFormComplete: true,
      customerFormComplete: false,
      isDemo: true,
    }
    await expect(
      t.mutation(internal.demoBookings.insertDemoBatch, {
        bookings: [malformed as unknown as never],
        customers: [],
        profiles: [],
        resources: [],
      }),
    ).rejects.toThrow(/[Vv]alidat/)
  })

  it('rejects resources with non-resourceOwnerType resourceType', async () => {
    const t = makeT()
    await expect(
      t.mutation(internal.demoBookings.insertDemoBatch, {
        bookings: [],
        customers: [],
        profiles: [],
        resources: [{
          bookingLocalIndex: 0,
          resourceType: 'NotARealType',
          externalName: 'x',
        } as unknown as never],
      }),
    ).rejects.toThrow(/[Vv]alidat/)
  })
})
