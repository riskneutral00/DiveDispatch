/**
 * @module-tag slow
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { seedPortalFixture, type SeedCtx } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

// ─── Setup ────────────────────────────────────────────────────────────────────

// ─── savePortalWaiver ─────────────────────────────────────────────────────────

describe('savePortalWaiver', () => {
  it('sets waiverSignedAt timestamp on the customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-waiver-1' },
        profile: { linkToken: 'tok-waiver-1' },
      }),
    )

    // Store a real file blob to get a valid _storage ID (required by v.id('_storage'))
    const signatureStorageId = await t.run(async (ctx: SeedCtx) => ctx.storage.store(new Blob(['sig'])))

    const before = Date.now()
    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })
    const after = Date.now()

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(typeof profile?.waiverSignedAt).toBe('number')
    expect(profile!.waiverSignedAt as number).toBeGreaterThanOrEqual(before)
    expect(profile!.waiverSignedAt as number).toBeLessThanOrEqual(after)
  })

  it('sets portalWaiver=true on the booking', async () => {
    const t = makeT()
    const { token, bookingId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-waiver-2' },
        profile: { linkToken: 'tok-waiver-2' },
      }),
    )
    const signatureStorageId = await t.run(async (ctx: SeedCtx) => ctx.storage.store(new Blob(['sig'])))

    await t.mutation(api.customerProfiles.savePortalWaiver, {
      token,
      signatureStorageId,
    })

    const booking = await t.run(async (ctx: SeedCtx) => ctx.db.get(bookingId))
    expect(booking?.portalWaiver).toBe(true)
  })

  it('requires signatureStorageId — throws without it', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: { bookingFormComplete: false },
        link: { token: 'tok-waiver-3' },
        profile: { linkToken: 'tok-waiver-3' },
      }),
    )

    await expect(
      t.mutation(
        api.customerProfiles.savePortalWaiver,
        // @ts-expect-error - testing that missing required arg throws
        { token },
      ),
    ).rejects.toThrow()
  })
})
