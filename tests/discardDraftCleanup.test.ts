/**
 * DD-157: discardDraft must delete bookingAuditLog and bookingResources rows.
 *
 * Verifies that after discarding a draft booking, no orphaned rows remain
 * in bookingAuditLog or bookingResources referencing the deleted bookingId.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id, Doc } from '../convex/_generated/dataModel'
import { seedUser, seedBooking, seedBookingResource, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Seed helpers ────────────────────────────────────────────────────────────

async function seedAuditLog(
  ctx: SeedCtx,
  bookingId: Id<'bookings'>,
  overrides: {
    action?: Doc<'bookingAuditLog'>['action']
    actorSlug?: string
    actorType?: Doc<'bookingAuditLog'>['actorType']
  } = {},
) {
  return ctx.db.insert('bookingAuditLog', {
    bookingId,
    action: overrides.action ?? 'created',
    actorSlug: overrides.actorSlug ?? 'dc-discard',
    actorType: overrides.actorType ?? 'operator',
    timestamp: Date.now(),
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('discardDraft cleanup (DD-157)', () => {
  it('deletes bookingAuditLog rows when discarding a draft', async () => {
    const t = makeT()

    const ids = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-discard', tokenIdentifier: 'clerk|dc-discard', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-discard' })

      const audit1 = await seedAuditLog(ctx, bookingId, { action: 'created' })
      const audit2 = await seedAuditLog(ctx, bookingId, { action: 'edited' })

      return { bookingId, audit1, audit2 }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-discard' }).mutation(
      api.bookingDraftMutations.discardDraft,
      { bookingId: ids.bookingId },
    )

    await t.run(async (ctx) => {
      const audit1 = await ctx.db.get(ids.audit1)
      const audit2 = await ctx.db.get(ids.audit2)
      expect(audit1).toBeNull()
      expect(audit2).toBeNull()
    })
  })

  it('deletes bookingResources rows when discarding a draft', async () => {
    const t = makeT()

    const ids = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-discard2', tokenIdentifier: 'clerk|dc-discard2', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-discard2' })

      const res1 = await seedBookingResource(ctx, bookingId, { resourceType: 'Instructor', resourceSlug: 'inst-1' })
      const res2 = await seedBookingResource(ctx, bookingId, { resourceType: 'DiveSite', externalName: 'Coral Reef' })

      return { bookingId, res1, res2 }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-discard2' }).mutation(
      api.bookingDraftMutations.discardDraft,
      { bookingId: ids.bookingId },
    )

    await t.run(async (ctx) => {
      const res1 = await ctx.db.get(ids.res1)
      const res2 = await ctx.db.get(ids.res2)
      expect(res1).toBeNull()
      expect(res2).toBeNull()
    })
  })

  it('deletes both audit and resource rows together', async () => {
    const t = makeT()

    const ids = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'dc-discard3', tokenIdentifier: 'clerk|dc-discard3', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, { ownerId: 'dc-discard3' })

      const auditId = await seedAuditLog(ctx, bookingId)
      const resourceId = await seedBookingResource(ctx, bookingId, { resourceType: 'Boat', externalName: 'Sea Star' })

      return { bookingId, auditId, resourceId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-discard3' }).mutation(
      api.bookingDraftMutations.discardDraft,
      { bookingId: ids.bookingId },
    )

    await t.run(async (ctx) => {
      const audit = await ctx.db.get(ids.auditId)
      const resource = await ctx.db.get(ids.resourceId)
      expect(audit).toBeNull()
      expect(resource).toBeNull()

      // Booking itself is gone
      const booking = await ctx.db.get(ids.bookingId)
      expect(booking).toBeNull()
    })
  })
})
