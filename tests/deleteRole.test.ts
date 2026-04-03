/**
 * DD-449: deleteRole mutation and bookingCountForRole query tests.
 * TDD: written before implementation.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures'
import { seedBooking } from './fixtures/seedBookings'
import { seedBookingResource } from './fixtures/seedBookings'
import { seedInventoryUnit, seedSnapshot } from './fixtures/seedInventory'
import { seedDiveCenterProfile, seedInstructorProfile, seedBoatProfile } from './fixtures/seedProfiles'
import { makeT } from './helpers/convex-helpers'
import type { Id } from '../convex/_generated/dataModel'

// ─── bookingCountForRole ─────────────────────────────────────────────────────

describe('userRoles.bookingCountForRole', () => {
  it('returns 0 for a role with no bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    const count = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.bookingCountForRole, { roleId: roleId! })

    expect(count).toBe(0)
  })

  it('returns count of Draft and Upcoming bookings that use the role slug', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: true,
      })

      const draftBookingId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Draft',
      })
      const upcomingBookingId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Upcoming',
      })

      await seedBookingResource(ctx, draftBookingId, {
        resourceType: 'Instructor',
        resourceSlug: TEST_SLUGS.diveCenter,
      })
      await seedBookingResource(ctx, upcomingBookingId, {
        resourceType: 'Instructor',
        resourceSlug: TEST_SLUGS.diveCenter,
      })
    })

    const count = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.bookingCountForRole, { roleId: roleId! })

    expect(count).toBe(2)
  })

  it('does not count Completed or Cancelled bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: true,
      })

      const completedId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Completed',
      })
      const cancelledId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Cancelled',
      })
      const draftId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Draft',
      })

      for (const bookingId of [completedId, cancelledId, draftId]) {
        await seedBookingResource(ctx, bookingId, {
          resourceType: 'Instructor',
          resourceSlug: TEST_SLUGS.diveCenter,
        })
      }
    })

    const count = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.bookingCountForRole, { roleId: roleId! })

    // Only the Draft booking counts; Completed and Cancelled do not
    expect(count).toBe(1)
  })
})

// ─── deleteRole ──────────────────────────────────────────────────────────────

describe('userRoles.deleteRole', () => {
  it('throws LAST_ROLE when user has exactly 1 role', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: true,
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .mutation(api.userRoles.deleteRole, { roleId: roleId! }),
    ).rejects.toThrow(/LAST_ROLE/)
  })

  it('returns { blocked: true, bookingCount: 2 } when role has active bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: true,
      })
      // Second role so LAST_ROLE guard passes
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })

      const b1 = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Draft',
      })
      const b2 = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Upcoming',
      })

      await seedBookingResource(ctx, b1, {
        resourceType: 'Instructor',
        resourceSlug: TEST_SLUGS.diveCenter,
      })
      await seedBookingResource(ctx, b2, {
        resourceType: 'Instructor',
        resourceSlug: TEST_SLUGS.diveCenter,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    expect(result).toEqual({ blocked: true, bookingCount: 2 })
  })

  it('succeeds and hard-deletes userRoles, profile, inventoryUnits when no active bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>
    let userId: Id<'users'>
    let unitId: Id<'inventoryUnits'>
    let snapId: Id<'availabilitySnapshots'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, { skipUserRoles: true })

      // Two roles so LAST_ROLE guard passes
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: true,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })

      // Profile record
      await seedInstructorProfile(ctx, userId)

      // InventoryUnit + snapshot owned by user's slug
      unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'Instructor',
      })
      snapId = await seedSnapshot(ctx, unitId)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    // Not blocked
    expect(result).toEqual({ deleted: true })

    await t.run(async (ctx) => {
      // userRoles row gone
      const role = await ctx.db.get(roleId!)
      expect(role).toBeNull()

      // instructor profile gone
      const profile = await ctx.db
        .query('instructors')
        .withIndex('by_userId', (q) => q.eq('userId', userId!))
        .unique()
      expect(profile).toBeNull()

      // inventoryUnit gone
      const unit = await ctx.db.get(unitId!)
      expect(unit).toBeNull()

      // snapshot gone
      const snap = await ctx.db.get(snapId!)
      expect(snap).toBeNull()
    })
  })

  it('succeeds after bookings are resolved (Completed/Cancelled)', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        createdAt: Date.now(),
        profileComplete: false,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })

      const completedId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Completed',
      })
      const cancelledId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Cancelled',
      })

      for (const id of [completedId, cancelledId]) {
        await seedBookingResource(ctx, id, {
          resourceType: 'Instructor',
          resourceSlug: TEST_SLUGS.diveCenter,
        })
      }
    })

    // Must succeed — no Draft/Upcoming bookings
    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    expect(result).toEqual({ deleted: true })

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId!)
      expect(role).toBeNull()
    })
  })

  it('throws UNAUTHENTICATED for unauthenticated caller', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })
    })

    await expect(
      makeT().mutation(api.userRoles.deleteRole, { roleId: roleId! }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('throws FORBIDDEN when caller does not own the role', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      // Create a different user who owns the role
      const otherUserId = await seedUser(ctx, {
        tokenIdentifier: 'test|other-owner',
        slug: 'other-owner',
        skipUserRoles: true,
      })
      roleId = await ctx.db.insert('userRoles', {
        userId: otherUserId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })
      // Also give them a second role so LAST_ROLE doesn't trigger
      await ctx.db.insert('userRoles', {
        userId: otherUserId,
        role: 'Boat',
        createdAt: Date.now(),
        profileComplete: false,
      })

      // Seed the caller (diveCenter user) so they exist but don't own the role
      await seedUser(ctx, { skipUserRoles: true })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .mutation(api.userRoles.deleteRole, { roleId: roleId! }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})
