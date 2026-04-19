/**
 * DD-300: Equipment inventory CRUD mutations for equipment managers.
 *
 * Tests addItem, updateItem, removeItem, and listMyInventory mutations
 * covering: happy paths, auth/role enforcement, ownership guards,
 * active-reservation guards, and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { TEST_TOKENS, TEST_SLUGS, seedUser, seedBooking, seedSession, seedReservation, seedSnapshot } from './fixtures'

// ── Constants ────────────────────────────────────────────────────────────────

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em

// ── addItem ──────────────────────────────────────────────────────────────────

describe('equipmentInventory.addItem', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('creates inventoryUnit and equipmentInventory row', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', manufacturer: 'Aqualung', size: 'M', totalUnits: 5 },
    )

    // Verify both rows created correctly
    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item).not.toBeNull()
      expect(item!.gearType).toBe('bcd')
      expect(item!.manufacturer).toBe('Aqualung')
      expect(item!.size).toBe('M')
      expect(item!.equipmentManagerId).toBe(EM_SLUG)

      const unit = await ctx.db.get(item!.inventoryUnitId)
      expect(unit).not.toBeNull()
      expect(unit!.resourceType).toBe('Equipment')
      expect(unit!.capacityModel).toBe('Pooled')
      expect(unit!.totalUnits).toBe(5)
      expect(unit!.ownerId).toBe(EM_SLUG)
      expect(unit!.ownerType).toBe('Equipment')
    })
  })

  it('creates item with optional prescription fields', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', diopter: -2.5, isPrescription: true, totalUnits: 3 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item!.gearType).toBe('mask')
      expect(item!.diopter).toBe(-2.5)
      expect(item!.isPrescription).toBe(true)
    })
  })

  it('rejects when caller lacks Equipment role', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.equipmentInventory.addItem,
        { gearType: 'fins', totalUnits: 10 },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.mutation(api.equipmentInventory.addItem, { gearType: 'fins', totalUnits: 10 }),
      'UNAUTHENTICATED',
    )
  })

  it('rejects totalUnits < 1', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.addItem,
        { gearType: 'bcd', totalUnits: 0 },
      ),
      'VALIDATION',
    )
  })
})

// ── updateItem ───────────────────────────────────────────────────────────────

describe('equipmentInventory.updateItem', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('patches equipmentInventory fields and inventoryUnit totalUnits', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', manufacturer: 'Aqualung', size: 'M', totalUnits: 5 },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, manufacturer: 'Scubapro', size: 'L', totalUnits: 10 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item!.manufacturer).toBe('Scubapro')
      expect(item!.size).toBe('L')

      const unit = await ctx.db.get(item!.inventoryUnitId)
      expect(unit!.totalUnits).toBe(10)
      expect(unit!.displayName).toBe('bcd - Scubapro (L)')
    })
  })

  it('clears diopter when isPrescription is set to false', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', manufacturer: 'Aqua Lung', totalUnits: 3, isPrescription: true, diopter: -2.5 },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, isPrescription: false },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item!.isPrescription).toBe(false)
      expect(item!.diopter).toBeUndefined()
    })
  })

  it('patches only totalUnits without touching inventory fields', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'wetsuit', manufacturer: 'O\'Neill', totalUnits: 3 },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, totalUnits: 7 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item!.manufacturer).toBe('O\'Neill')

      const unit = await ctx.db.get(item!.inventoryUnitId)
      expect(unit!.totalUnits).toBe(7)
    })
  })

  it('rejects NOT_FOUND for nonexistent item', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    // Create and delete to get a valid-format but nonexistent ID
    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', totalUnits: 1 },
    )
    await t.run(async (ctx) => { await ctx.db.delete(inventoryId) })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.updateItem,
        { inventoryId, manufacturer: 'Mares' },
      ),
      'NOT_FOUND',
    )
  })

  it('rejects FORBIDDEN when caller does not own the item', async () => {
    // Seed EM who owns the item
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', totalUnits: 5 },
    )

    // Seed a different user
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.other, slug: TEST_SLUGS.other, email: 'other@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).mutation(
        api.equipmentInventory.updateItem,
        { inventoryId, totalUnits: 99 },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects totalUnits < 1', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'regulator', totalUnits: 2 },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.updateItem,
        { inventoryId, totalUnits: 0 },
      ),
      'VALIDATION',
    )
  })

  it('rejects FORBIDDEN for authenticated non-Equipment-role user even if they own the item', async () => {
    // Seed a DiveCenter user (no Equipment role)
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
    })

    // Directly insert an equipmentInventory row owned by the DC slug
    // (bypassing addItem to avoid the role gate on addItem itself)
    const inventoryId = await t.run(async (ctx) => {
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: TEST_SLUGS.diveCenter,
        displayName: 'fins - test',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'Equipment',
      })
      return ctx.db.insert('equipmentInventory', {
        inventoryUnitId: unitId,
        equipmentManagerId: TEST_SLUGS.diveCenter,
        gearType: 'fins',
      })
    })

    // DC user owns the item (slug matches) but lacks Equipment role
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.equipmentInventory.updateItem,
        { inventoryId, manufacturer: 'Mares' },
      ),
      'FORBIDDEN',
    )
  })

  it('syncs snapshots on totalUnits increase (DD-350)', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', totalUnits: 5 },
    )

    const snapshotId = await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      return seedSnapshot(ctx, item!.inventoryUnitId, {
        totalUnits: 5,
        reservedUnits: 3,
        availableUnits: 2,
      })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, totalUnits: 10 },
    )

    await t.run(async (ctx) => {
      const snap = await ctx.db.get(snapshotId)
      expect(snap!.totalUnits).toBe(10)
      expect(snap!.availableUnits).toBe(7)
    })
  })

  it('syncs snapshots on totalUnits decrease (DD-350)', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'regulator', totalUnits: 10 },
    )

    const snapshotId = await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      return seedSnapshot(ctx, item!.inventoryUnitId, {
        totalUnits: 10,
        reservedUnits: 3,
        availableUnits: 7,
      })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, totalUnits: 4 },
    )

    await t.run(async (ctx) => {
      const snap = await ctx.db.get(snapshotId)
      expect(snap!.totalUnits).toBe(4)
      expect(snap!.availableUnits).toBe(1)
    })
  })

  it('syncs snapshots at totalUnits === maxReserved boundary (DD-350)', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', totalUnits: 10 },
    )

    const snapshotId = await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      return seedSnapshot(ctx, item!.inventoryUnitId, {
        totalUnits: 10,
        reservedUnits: 5,
        availableUnits: 5,
      })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.updateItem,
      { inventoryId, totalUnits: 5 },
    )

    await t.run(async (ctx) => {
      const snap = await ctx.db.get(snapshotId)
      expect(snap!.totalUnits).toBe(5)
      expect(snap!.availableUnits).toBe(0)
    })
  })

  it('rejects VALIDATION when reducing totalUnits below reserved count', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', totalUnits: 10 },
    )

    // Create a snapshot showing 4 reserved units
    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      await seedSnapshot(ctx, item!.inventoryUnitId, {
        totalUnits: 10,
        reservedUnits: 4,
        availableUnits: 6,
      })
    })

    // Attempt to reduce to 3 — below the 4 reserved
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.updateItem,
        { inventoryId, totalUnits: 3 },
      ),
      'VALIDATION',
    )
  })
})

// ── removeItem ───────────────────────────────────────────────────────────────

describe('equipmentInventory.removeItem', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('deletes both equipmentInventory and inventoryUnit rows', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', totalUnits: 2 },
    )

    // Capture the inventoryUnitId before deletion
    const unitId = await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      return item!.inventoryUnitId
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.removeItem,
      { inventoryId },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item).toBeNull()
      const unit = await ctx.db.get(unitId)
      expect(unit).toBeNull()
    })
  })

  it('rejects removal when active PendingAcceptance reservations exist', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', totalUnits: 3 },
    )

    // Create a reservation referencing the inventoryUnit
    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, item!.inventoryUnitId)
      await seedReservation(ctx, bookingId, item!.inventoryUnitId, sessionId, { status: 'PendingAcceptance' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
      'CONFLICT',
    )
  })

  it('rejects removal when active Confirmed reservations exist', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'regulator', totalUnits: 2 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, item!.inventoryUnitId)
      await seedReservation(ctx, bookingId, item!.inventoryUnitId, sessionId, { status: 'Confirmed' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
      'CONFLICT',
    )
  })

  it('allows removal when only Vacated reservations exist', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'wetsuit', totalUnits: 1 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, item!.inventoryUnitId)
      await seedReservation(ctx, bookingId, item!.inventoryUnitId, sessionId, { status: 'Vacated' })
    })

    // Should not throw
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.removeItem,
      { inventoryId },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      expect(item).toBeNull()
    })
  })

  it('rejects FORBIDDEN when caller does not own the item', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', totalUnits: 4 },
    )

    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.other, slug: TEST_SLUGS.other, email: 'other@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects NOT_FOUND for nonexistent item', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', totalUnits: 1 },
    )
    await t.run(async (ctx) => { await ctx.db.delete(inventoryId) })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
      'NOT_FOUND',
    )
  })

  it('rejects FORBIDDEN for authenticated non-Equipment-role user even if they own the item', async () => {
    // Seed a DiveCenter user (no Equipment role)
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: TEST_TOKENS.diveCenter, slug: TEST_SLUGS.diveCenter, role: 'DiveCenter' })
    })

    // Directly insert an equipmentInventory row owned by the DC slug
    const inventoryId = await t.run(async (ctx) => {
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: TEST_SLUGS.diveCenter,
        displayName: 'fins - test',
        capacityModel: 'Pooled',
        totalUnits: 4,
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'Equipment',
      })
      return ctx.db.insert('equipmentInventory', {
        inventoryUnitId: unitId,
        equipmentManagerId: TEST_SLUGS.diveCenter,
        gearType: 'fins',
      })
    })

    // DC user owns the item (slug matches) but lacks Equipment role
    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
      'FORBIDDEN',
    )
  })
})

// ── listMyInventory ──────────────────────────────────────────────────────────

describe('equipmentInventory.listMyInventory', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('returns inventory grouped by gearType', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', manufacturer: 'Aqualung', totalUnits: 5 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', manufacturer: 'Scubapro', totalUnits: 3 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', totalUnits: 10 },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )

    expect(Object.keys(result)).toHaveLength(2)
    expect(result.bcd).toHaveLength(2)
    expect(result.mask).toHaveLength(1)

    expect(result.bcd[0].manufacturer).toBe('Aqualung')
    expect(result.bcd[0].totalUnits).toBe(5)
    expect(result.bcd[1].manufacturer).toBe('Scubapro')
    expect(result.bcd[1].totalUnits).toBe(3)
    expect(result.mask[0].totalUnits).toBe(10)
  })

  it('returns empty object when EM has no inventory', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )

    expect(result).toEqual({})
  })

  it('only returns items owned by the calling EM', async () => {
    const OTHER_EM_TOKEN = 'test|em-other'
    const OTHER_EM_SLUG = 'em-other-slug'

    // Seed two EMs
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
      await seedUser(ctx, { tokenIdentifier: OTHER_EM_TOKEN, slug: OTHER_EM_SLUG, role: 'Equipment', email: 'em2@test.com' })
    })

    // Each EM adds items
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', totalUnits: 8 },
    )
    await t.withIdentity({ tokenIdentifier: OTHER_EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'wetsuit', totalUnits: 4 },
    )

    // First EM should only see their own
    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )

    expect(Object.keys(result)).toEqual(['fins'])
    expect(result.fins).toHaveLength(1)
    expect(result.fins[0].totalUnits).toBe(8)
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.query(api.equipmentInventory.listMyInventory, {}),
      'UNAUTHENTICATED',
    )
  })
})

// ── bulkSetByManufacturer ────────────────────────────────────────────────────

describe('equipmentInventory.bulkSetByManufacturer', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  const seedEquipment = async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })
  }

  it('creates rows for new sizes and skips cells with count 0', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      {
        gearType: 'wetsuit',
        manufacturer: 'ScubaPro',
        cells: { '2XS': 4, 'XS': 4, 'S': 4, 'M': 0 },
      },
    )

    const grouped = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )
    const rows = (grouped.wetsuit ?? []).filter((r) => r.manufacturer === 'ScubaPro')
    expect(rows).toHaveLength(3)
    const bySize = Object.fromEntries(rows.map((r) => [r.size, r.totalUnits]))
    expect(bySize).toEqual({ '2XS': 4, 'XS': 4, 'S': 4 })
  })

  it('updates totalUnits on existing rows', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'bcd', manufacturer: 'Mares', cells: { 'M': 2, 'L': 3 } },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'bcd', manufacturer: 'Mares', cells: { 'M': 7, 'L': 3 } },
    )

    const grouped = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )
    const bySize = Object.fromEntries(
      (grouped.bcd ?? [])
        .filter((r) => r.manufacturer === 'Mares')
        .map((r) => [r.size, r.totalUnits]),
    )
    expect(bySize).toEqual({ 'M': 7, 'L': 3 })
  })

  it('deletes rows when size is omitted or count is 0', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'wetsuit', manufacturer: 'Aqua Lung', cells: { 'S': 2, 'M': 3, 'L': 4 } },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'wetsuit', manufacturer: 'Aqua Lung', cells: { 'S': 0, 'M': 3 } },
    )

    const grouped = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )
    const rows = (grouped.wetsuit ?? []).filter((r) => r.manufacturer === 'Aqua Lung')
    expect(rows).toHaveLength(1)
    expect(rows[0].size).toBe('M')
    expect(rows[0].totalUnits).toBe(3)
  })

  it('rejects reducing totalUnits below max reserved', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'bcd', manufacturer: 'ScubaPro', cells: { 'L': 10 } },
    )

    await t.run(async (ctx) => {
      const row = (await ctx.db.query('equipmentInventory').collect())
        .find((r) => r.manufacturer === 'ScubaPro' && r.size === 'L')!
      await seedSnapshot(ctx, row.inventoryUnitId, {
        totalUnits: 10,
        reservedUnits: 4,
        availableUnits: 6,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetByManufacturer,
        { gearType: 'bcd', manufacturer: 'ScubaPro', cells: { 'L': 3 } },
      ),
      'VALIDATION',
    )
  })

  it('rejects deleting rows with active reservations', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'wetsuit', manufacturer: 'ScubaPro', cells: { 'M': 5 } },
    )

    await t.run(async (ctx) => {
      const row = (await ctx.db.query('equipmentInventory').collect())
        .find((r) => r.manufacturer === 'ScubaPro' && r.size === 'M')!
      const bookingId = await seedBooking(ctx)
      const sessionId = await seedSession(ctx, bookingId, row.inventoryUnitId)
      await seedReservation(ctx, bookingId, row.inventoryUnitId, sessionId, { status: 'Confirmed' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetByManufacturer,
        { gearType: 'wetsuit', manufacturer: 'ScubaPro', cells: {} },
      ),
      'CONFLICT',
    )
  })

  it('scopes reconciliation by sizeSystem for fins', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      {
        gearType: 'fins',
        manufacturer: 'ScubaPro',
        sizeSystem: 'eu',
        cells: { '40-41': 3, '42-43': 3 },
      },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      {
        gearType: 'fins',
        manufacturer: 'ScubaPro',
        sizeSystem: 'us',
        cells: { '9-10': 2, '11-12': 2 },
      },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      {
        gearType: 'fins',
        manufacturer: 'ScubaPro',
        sizeSystem: 'eu',
        cells: { '40-41': 5 },
      },
    )

    const grouped = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )
    const finRows = (grouped.fins ?? []).filter((r) => r.manufacturer === 'ScubaPro')
    const euRows = finRows.filter((r) => r.sizeSystem === 'eu')
    const usRows = finRows.filter((r) => r.sizeSystem === 'us')

    expect(euRows).toHaveLength(1)
    expect(euRows[0].size).toBe('40-41')
    expect(euRows[0].totalUnits).toBe(5)

    expect(usRows).toHaveLength(2)
    const usBySize = Object.fromEntries(usRows.map((r) => [r.size, r.totalUnits]))
    expect(usBySize).toEqual({ '9-10': 2, '11-12': 2 })
  })
})
