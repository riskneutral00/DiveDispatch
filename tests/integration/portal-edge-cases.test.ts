import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import {
  seedUser,
  seedPortalFixture,
} from '../fixtures'

describe('portal token edge cases — getByToken status surface', () => {
  it('returns not_found for an unknown token', async () => {
    const t = makeT()
    const result = await t.query(api.bookingLinks.getByToken, { token: 'nonexistent-token-uuid' })
    expect(result.status).toBe('not_found')
  })

  it('returns expired for a token whose expiresAt is in the past', async () => {
    const t = makeT()
    const token = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-expired', tokenIdentifier: 'clerk|dc-expired' })
      const { token } = await seedPortalFixture(ctx, {
        booking: { ownerId: 'dc-expired' },
        link: { expiresAt: Date.now() - 1000 },
      })
      return token
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('expired')
  })

  it('returns completed for a token already used (usedAt set)', async () => {
    const t = makeT()
    const token = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-used', tokenIdentifier: 'clerk|dc-used' })
      const { token } = await seedPortalFixture(ctx, {
        booking: { ownerId: 'dc-used' },
        link: { usedAt: Date.now() },
      })
      return token
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('completed')
  })

  it('returns valid for a fresh, unused, in-window token on a Draft booking', async () => {
    const t = makeT()
    const token = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-valid', tokenIdentifier: 'clerk|dc-valid' })
      const { token } = await seedPortalFixture(ctx, {
        booking: { ownerId: 'dc-valid' },
      })
      return token
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })
    expect(result.status).toBe('valid')
  })
})

describe('portal: idempotency and replay safety', () => {
  it('submitting the same token twice does not double-write customerFormComplete', async () => {
    const t = makeT()
    const { bookingId, token } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-idem', tokenIdentifier: 'clerk|dc-idem' })
      const { bookingId, token } = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-idem',
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
        },
      })
      return { bookingId, token }
    })

    const first = await t.mutation(api.portalSubmission.submitPortal, { token })
    expect(first.medicalHardBlock).toBe(false)

    const beforeSecond = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId)
      return b?.customerFormComplete
    })
    expect(beforeSecond).toBe(true)

    await t.mutation(api.portalSubmission.submitPortal, { token }).catch(() => {})

    const afterSecond = await t.run(async (ctx) => {
      const b = await ctx.db.get(bookingId)
      return b?.customerFormComplete
    })
    expect(afterSecond).toBe(true)
  })
})
