/**
 * DD-449: deleteRole mutation and bookingCountForRole query tests.
 * TDD: written before implementation.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS, findProfileByUser, getOrCreateTestOrg } from './fixtures'
import { seedBooking, seedSession, seedReservation } from './fixtures/seedBookings'
import { seedBookingResource } from './fixtures/seedBookings'
import { seedInventoryUnit, seedSnapshot } from './fixtures/seedInventory'
import { seedInstructorProfile } from './fixtures/seedProfiles'
import { makeT } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'
import type { Id } from '../convex/_generated/dataModel'

// ─── bookingCountForRole ─────────────────────────────────────────────────────

describe('userRoles.bookingCountForRole', () => {
  it('returns 0 for a role with no bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
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
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
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
        resourceId: TEST_SLUGS.diveCenter,
      })
      await seedBookingResource(ctx, upcomingBookingId, {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.diveCenter,
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
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
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
          resourceId: TEST_SLUGS.diveCenter,
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
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
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
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
      })
      // Second role so LAST_ROLE guard passes
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
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
        resourceId: TEST_SLUGS.diveCenter,
      })
      await seedBookingResource(ctx, b2, {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.diveCenter,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    expect(result).toEqual({ blocked: true, bookingCount: 2 })
  })

  it('succeeds and hard-deletes userRoles, profile, inventoryUnits, reservations, snapshots when no active bookings', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>
    let userId: Id<'users'>
    let unitId: Id<'inventoryUnits'>
    let snapId: Id<'availabilitySnapshots'>
    let reservationId: Id<'reservations'>

    await t.run(async (ctx) => {
      userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)

      // Two roles so LAST_ROLE guard passes
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })

      // Profile record
      await seedInstructorProfile(ctx, userId)

      // InventoryUnit + snapshot + reservation owned by user's slug
      unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'Instructor',
      })
      snapId = await seedSnapshot(ctx, unitId)

      // Seed a Completed booking (does not block delete) with a reservation tied to the unit
      const completedBookingId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        status: 'Completed',
      })
      const sessionId = await seedSession(ctx, completedBookingId, unitId)
      reservationId = await seedReservation(ctx, completedBookingId, unitId, sessionId, {
        status: 'Confirmed',
      })
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
      const profile = await findProfileByUser(ctx, userId!, 'diveStaff')
      expect(profile).toBeNull()

      // inventoryUnit gone
      const unit = await ctx.db.get(unitId!)
      expect(unit).toBeNull()

      // snapshot gone
      const snap = await ctx.db.get(snapId!)
      expect(snap).toBeNull()

      // reservation gone — CRITICAL: dangling reservations would corrupt snapshot math
      const reservation = await ctx.db.get(reservationId!)
      expect(reservation).toBeNull()
    })
  })

  it('succeeds after bookings are resolved (Completed/Cancelled)', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
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
          resourceId: TEST_SLUGS.diveCenter,
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
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
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
      const otherOrgId = await getOrCreateTestOrg(ctx, otherUserId)
      roleId = await ctx.db.insert('userRoles', {
        userId: otherUserId,
        role: 'DiveCenter',
        organizationId: otherOrgId,
        createdAt: Date.now(),
      })
      // Also give them a second role so LAST_ROLE doesn't trigger
      await ctx.db.insert('userRoles', {
        userId: otherUserId,
        role: 'Boat',
        organizationId: otherOrgId,
        createdAt: Date.now(),
      })

      // Seed the caller (diveCenter user) so they exist but don't own the role
      await seedUser(ctx, { skipUserRoles: true })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .mutation(api.userRoles.deleteRole, { roleId: roleId! }),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('deletes role profile when org slug differs from user slug (real Clerk-org scenario)', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>
    let userId: Id<'users'>
    let orgId: Id<'organizations'>

    await t.run(async (ctx) => {
      orgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_seafun',
        slug: 'sea-fun-divers',
        name: 'Sea Fun Divers',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|rene',
        slug: 'rene-user-slug',
        email: 'rene@example.com',
        firstName: 'Rene',
        lastName: 'Balot',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
        organizationId: orgId,
      })

      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId: orgId,
        createdAt: Date.now(),
      })
      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Compressor',
        organizationId: orgId,
        createdAt: Date.now(),
      })

      await ctx.db.insert('compressors', { slug: 'test-c-' + Math.random().toString(36).slice(2,8),
        organizationId: orgId,
        name: 'Scuba Market',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.88,
        lng: 98.39,
        email: 'compressor@example.com',
        phone: '+66111222333',
        gasMixes: ['air'],
        verified: false,
      })
    })

    const result = await t
      .withIdentity({
        tokenIdentifier: 'clerk|rene',
        orgId: 'org_seafun',
        orgRole: 'admin',
        orgSlug: 'sea-fun-divers',
      })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    expect(result).toEqual({ deleted: true })

    await t.run(async (ctx) => {
      const orphan = await ctx.db
        .query('compressors')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId!))
        .unique()
      expect(orphan).toBeNull()
    })
  })

  it('deletes inventoryUnits and equipmentInventory rows when Equipment role is deleted', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>
    let unitId: Id<'inventoryUnits'>

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)

      roleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'Equipment',
        organizationId,
        createdAt: Date.now(),
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })

      unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'Equipment',
        resourceType: 'Equipment',
      })
      await ctx.db.insert('equipmentInventory', {
        inventoryUnitId: unitId,
        equipmentManagerId: TEST_SLUGS.diveCenter,
        gearType: 'mask',
        manufacturer: 'Scubapro',
        size: 'M',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    expect(result).toEqual({ deleted: true })

    await t.run(async (ctx) => {
      const remainingUnit = await ctx.db.get(unitId!)
      expect(remainingUnit).toBeNull()

      const remainingInventory = await ctx.db
        .query('equipmentInventory')
        .withIndex('by_equipmentManagerId', (q) =>
          q.eq('equipmentManagerId', TEST_SLUGS.diveCenter),
        )
        .collect()
      expect(remainingInventory).toHaveLength(0)
    })
  })

  it('keeps the profile when another user in the same org still holds the role', async () => {
    const t = makeT()
    let roleId: Id<'userRoles'>
    let orgId: Id<'organizations'>

    await t.run(async (ctx) => {
      orgId = await ctx.db.insert('organizations', {
        clerkOrgId: 'org_shared',
        slug: 'shared-org',
        name: 'Shared Org',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const aliceId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|alice',
        slug: 'alice-slug',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'A',
        organizationId: orgId,
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
      const bobId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bob',
        slug: 'bob-slug',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'B',
        organizationId: orgId,
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })

      await ctx.db.insert('userRoles', { userId: aliceId, role: 'DiveCenter', organizationId: orgId, createdAt: Date.now() })
      roleId = await ctx.db.insert('userRoles', { userId: aliceId, role: 'Compressor', organizationId: orgId, createdAt: Date.now() })
      await ctx.db.insert('userRoles', { userId: bobId, role: 'Compressor', organizationId: orgId, createdAt: Date.now() })

      await ctx.db.insert('compressors', { slug: 'test-c-' + Math.random().toString(36).slice(2,8),
        organizationId: orgId,
        name: 'Shared Compressor',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'shared@example.com',
        phone: '+66111222333',
        gasMixes: ['air'],
        verified: false,
      })
    })

    await t
      .withIdentity({
        tokenIdentifier: 'clerk|alice',
        orgId: 'org_shared',
        orgRole: 'admin',
        orgSlug: 'shared-org',
      })
      .mutation(api.userRoles.deleteRole, { roleId: roleId! })

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('compressors')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId!))
        .unique()
      expect(profile).not.toBeNull()
      expect(profile!.name).toBe('Shared Compressor')
    })
  })
})
