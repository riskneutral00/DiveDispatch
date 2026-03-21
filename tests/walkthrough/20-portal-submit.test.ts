import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

// ─── Setup ────────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

/**
 * Seeds a full portal fixture with contact + medical + waiver complete so
 * submitPortal can run without validation errors.
 */
async function seedSubmittablePortal(ctx: Ctx) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-submit-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: '2030-09-01',
    endDate: '2030-09-01',
    divers: [
      {
        name: 'Dana',
        abbrev: 'D',
        flag: { code: 'US', label: 'United States' },
        startDate: '2030-09-01',
        endDate: '2030-09-01',
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Submit DC',
    // No required portal steps — all optional — so submitPortal won't block
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = 'tok-submit-' + Math.random().toString(36).slice(2, 10)
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Dana Diver',
    email: 'dana@example.com',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, linkId, profileId }
}

/**
 * Seeds a portal fixture with all 3 required steps enabled and completed,
 * for testing submitPortal validation checks.
 */
async function seedPortalWithRequiredSteps(ctx: Ctx) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-req-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: '2030-09-10',
    endDate: '2030-09-10',
    divers: [
      {
        name: 'Evan',
        abbrev: 'E',
        flag: { code: 'GB', label: 'United Kingdom' },
        startDate: '2030-09-10',
        endDate: '2030-09-10',
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Required DC',
    portalContact: true,
    portalMedical: true,
    portalWaiver: true,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = 'tok-req-' + Math.random().toString(36).slice(2, 10)
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Evan Diver',
    email: 'evan@example.com',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, linkId, profileId }
}

// ─── submitPortal ─────────────────────────────────────────────────────────────

describe('submitPortal', () => {
  it('sets customerFormComplete=true on the booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx) => seedSubmittablePortal(ctx))

    await t.mutation(api.portalSubmission.submitPortal, { token })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.customerFormComplete).toBe(true)
  })

  it('sets submittedAt timestamp on the customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedSubmittablePortal(ctx))

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile?.submittedAt).toBeDefined()
    expect(profile!.submittedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.submittedAt as number).toBeLessThanOrEqual(after)
  })

  it('sets usedAt on the booking link', async () => {
    const t = makeT()
    const { token, linkId } = await t.run(async (ctx) => seedSubmittablePortal(ctx))

    const before = Date.now()
    await t.mutation(api.portalSubmission.submitPortal, { token })
    const after = Date.now()

    const link = await t.run(async (ctx) => ctx.db.get(linkId))
    expect(link?.usedAt).toBeDefined()
    expect(link!.usedAt as number).toBeGreaterThanOrEqual(before)
    expect(link!.usedAt as number).toBeLessThanOrEqual(after)
  })

  it('rejects submission when required contact form is missing', async () => {
    const t = makeT()
    // portalContact=true but profile has no customerId
    const { token } = await t.run(async (ctx) => seedPortalWithRequiredSteps(ctx))

    await expect(
      t.mutation(api.portalSubmission.submitPortal, { token }),
    ).rejects.toBeDefined()
  })
})
