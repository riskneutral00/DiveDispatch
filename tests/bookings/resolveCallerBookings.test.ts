import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import { testDate } from '../helpers/dates'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('resolveCallerBookings ownerType isolation', () => {
  it('multi-role user sees only bookings for the queried role', async () => {
    const token = 'clerk|multi-role'
    const slug = 'multi-role'

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: token,
        slug,
        email: 'multi@test.com',
        name: 'Multi Role',
        firstName: 'Multi',
        lastName: 'Role',
        phone: '+66812345678',
        dateOfBirth: '1990-01-01',
        appLanguage: 'en',
      })

      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Agent',
        createdAt: Date.now(),
      })

      await ctx.db.insert('bookings', {
        ownerId: slug,
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: 0,
        paid: false,
        activityType: ['DSD'],
        startDate: testDate(7),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Multi Business',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
      })
    })

    const asAgent = await t
      .withIdentity({ tokenIdentifier: token })
      .query(api.bookings.listByStatus, { activeRole: 'Agent', status: 'Draft' })

    expect(asAgent).toHaveLength(0)

    const asDiveCenter = await t
      .withIdentity({ tokenIdentifier: token })
      .query(api.bookings.listByStatus, { activeRole: 'DiveCenter', status: 'Draft' })

    expect(asDiveCenter).toHaveLength(1)
  })
})
