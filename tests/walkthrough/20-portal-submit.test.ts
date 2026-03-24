import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate } from '../helpers/dates'
import { seedPortalFixture, type SeedCtx } from '../fixtures/seedFixture'

// ─── Setup ────────────────────────────────────────────────────────────────────

const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

// ─── submitPortal ─────────────────────────────────────────────────────────────

describe('submitPortal', () => {
  it('sets customerFormComplete=true on the booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-submit-test',
          activityType: ['DSD'],
          operatorName: 'Submit DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Dana',
              abbrev: 'D',
              flag: { code: 'US', label: 'United States' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { token: 'tok-submit-1', customerName: 'Dana Diver', email: 'dana@example.com' },
        profile: { linkToken: 'tok-submit-1' },
      }),
    )

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.customerFormComplete).toBe(true)
  })

  it('sets submittedAt timestamp on the customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-submit-test',
          activityType: ['DSD'],
          operatorName: 'Submit DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Dana',
              abbrev: 'D',
              flag: { code: 'US', label: 'United States' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { token: 'tok-submit-2', customerName: 'Dana Diver', email: 'dana@example.com' },
        profile: { linkToken: 'tok-submit-2' },
      }),
    )

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(profile?.submittedAt).toBeDefined()
    expect(profile!.submittedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.submittedAt as number).toBeLessThanOrEqual(after)
  })

  it('sets usedAt on the booking link', async () => {
    const t = makeT()
    const { token, linkId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-submit-test',
          activityType: ['DSD'],
          operatorName: 'Submit DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Dana',
              abbrev: 'D',
              flag: { code: 'US', label: 'United States' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { token: 'tok-submit-3', customerName: 'Dana Diver', email: 'dana@example.com' },
        profile: { linkToken: 'tok-submit-3' },
      }),
    )

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const link = await t.run(async (ctx: SeedCtx) => ctx.db.get(linkId))
    expect(link?.usedAt).toBeDefined()
    expect(link!.usedAt as number).toBeGreaterThanOrEqual(before)
    expect(link!.usedAt as number).toBeLessThanOrEqual(after)
  })

  it('rejects submission when required contact form is missing', async () => {
    const t = makeT()
    // portalContact=true but profile has no customerId
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-req-test',
          activityType: ['DSD'],
          operatorName: 'Required DC',
          startDate: testDate(10),
          endDate: testDate(10),
          portalContact: true,
          portalMedical: true,
          portalWaiver: true,
          bookingFormComplete: false,
          divers: [
            {
              name: 'Evan',
              abbrev: 'E',
              flag: { code: 'GB', label: 'United Kingdom' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['DSD'],
            },
          ],
        },
        link: { token: 'tok-req-1', customerName: 'Evan Diver', email: 'evan@example.com' },
        profile: { linkToken: 'tok-req-1' },
      }),
    )

    await expect(
      t.mutation(api.portalSubmission.submitPortal, { token }),
    ).rejects.toBeDefined()
  })
})
