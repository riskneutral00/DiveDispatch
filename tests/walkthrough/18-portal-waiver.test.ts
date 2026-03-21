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

async function seedPortalFixture(ctx: Ctx) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: '2030-06-15',
    endDate: '2030-06-15',
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: '2030-06-15',
        endDate: '2030-06-15',
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = 'tok-waiver-' + Math.random().toString(36).slice(2, 10)
  await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Alice',
    email: 'alice@example.com',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, profileId }
}

// ─── savePortalWaiver ─────────────────────────────────────────────────────────

describe('savePortalWaiver', () => {
  it('sets waiverSignedAt timestamp on the customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    // Store a real file blob to get a valid _storage ID (required by v.id('_storage'))
    const signatureStorageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['sig'])))

    const before = Date.now()
    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })
    const after = Date.now()

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))
    expect(profile?.waiverSignedAt).toBeDefined()
    expect(profile?.waiverSignedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile?.waiverSignedAt as number).toBeLessThanOrEqual(after)
  })

  it('sets portalWaiver=true on the booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx) => seedPortalFixture(ctx))
    const signatureStorageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['sig'])))

    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking?.portalWaiver).toBe(true)
  })

  it('requires signatureStorageId — throws without it', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    await expect(
      t.mutation(
        api.customerProfiles.savePortalWaiver,
        // @ts-expect-error - testing that missing required arg throws
        { token },
      ),
    ).rejects.toBeDefined()
  })
})
