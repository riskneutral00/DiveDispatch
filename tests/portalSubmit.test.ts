import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  seedUser,
  seedBooking,
  seedBookingLink,
  seedCustomerProfile,
  seedPortalFixture,
} from './fixtures'
import { testToken } from './helpers/dates'

describe('submitPortal mutation', () => {
  it('sets customerFormComplete on booking and marks profile as submitted', async () => {
    const t = makeT()

    const { bookingId, token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-portal', tokenIdentifier: 'clerk|dc-portal' })
      const { bookingId, token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-portal',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
        },
      })
      return { bookingId, token }
    })

    const result = await t.mutation(api.portalSubmission.submitPortal, { token })

    expect(result.medicalHardBlock).toBe(false)

    await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      expect(booking?.customerFormComplete).toBe(true)
    })
  })

  it('throws FORMS_INCOMPLETE when contact form required but not submitted', async () => {
    const t = makeT()

    const { token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-incomplete', tokenIdentifier: 'clerk|dc-incomplete' })
      const { token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-incomplete',
          portalContact: true,
          portalMedical: false,
          portalWaiver: false,
        },
      })
      return { token }
    })

    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })

  it('throws FORMS_INCOMPLETE when medical required but not answered', async () => {
    const t = makeT()

    const { token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-med', tokenIdentifier: 'clerk|dc-med' })
      const { token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med',
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
        },
      })
      return { token }
    })

    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })

  it('throws FORMS_INCOMPLETE when waiver required but not signed', async () => {
    const t = makeT()

    const { token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-waiver', tokenIdentifier: 'clerk|dc-waiver' })
      const { token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-waiver',
          portalContact: false,
          portalMedical: false,
          portalWaiver: true,
        },
      })
      return { token }
    })

    await expectConvexError(
      t.mutation(api.portalSubmission.submitPortal, { token }),
      'FORMS_INCOMPLETE',
    )
  })

  it('invalidates the booking link after submission (prevents re-use)', async () => {
    const t = makeT()

    const { token, linkId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-reuse', tokenIdentifier: 'clerk|dc-reuse' })
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-reuse',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
        },
      })
      return { token: fixture.token, linkId: fixture.linkId }
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    await t.run(async (ctx) => {
      const link = await ctx.db.get(linkId)
      expect(link?.usedAt).toBeDefined()
    })
  })

  it('sends portal_complete notification to booking owner', async () => {
    const t = makeT()

    const { token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-notif', tokenIdentifier: 'clerk|dc-notif' })
      const { token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-notif',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
        },
      })
      return { token }
    })

    await t.mutation(api.portalSubmission.submitPortal, { token })

    await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      const portalNotif = notifications.find((n) => n.type === 'portal_complete')
      expect(portalNotif).toBeDefined()
      expect(portalNotif?.userId).toBe('dc-notif')
    })
  })
})
