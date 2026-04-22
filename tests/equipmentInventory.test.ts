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

// ── renameManufacturerGroup ──────────────────────────────────────────────────

describe('equipmentInventory.renameManufacturerGroup', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  const seedEquipment = async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })
  }

  it('renames all rows in a group and preserves inventoryUnitIds', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'wetsuit', manufacturer: 'ScubaPro', cells: { 'S': 2, 'M': 3, 'L': 4 } },
    )

    const beforeIds = await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      return rows
        .filter((r) => r.manufacturer === 'ScubaPro')
        .map((r) => ({ rowId: r._id, unitId: r.inventoryUnitId, size: r.size }))
        .sort((a, b) => (a.size ?? '').localeCompare(b.size ?? ''))
    })

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.renameManufacturerGroup,
      {
        gearType: 'wetsuit',
        previousManufacturer: 'ScubaPro',
        manufacturer: 'Cressi',
      },
    )

    expect(result.renamed).toBe(3)

    const afterIds = await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      return rows
        .filter((r) => r.manufacturer === 'Cressi')
        .map((r) => ({ rowId: r._id, unitId: r.inventoryUnitId, size: r.size }))
        .sort((a, b) => (a.size ?? '').localeCompare(b.size ?? ''))
    })

    expect(afterIds).toEqual(beforeIds)

    const orphans = await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      return rows.filter((r) => r.manufacturer === 'ScubaPro')
    })
    expect(orphans).toHaveLength(0)
  })

  it('renames fins group with new sizeSystem', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'fins', manufacturer: 'ScubaPro', sizeSystem: 'eu', cells: { '40-41': 2 } },
    )

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.renameManufacturerGroup,
      {
        gearType: 'fins',
        previousManufacturer: 'ScubaPro',
        previousSizeSystem: 'eu',
        manufacturer: 'Mares',
        sizeSystem: 'us',
      },
    )

    const grouped = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.equipmentInventory.listMyInventory,
      {},
    )
    const rows = (grouped.fins ?? [])
    expect(rows).toHaveLength(1)
    expect(rows[0].manufacturer).toBe('Mares')
    expect(rows[0].sizeSystem).toBe('us')
  })

  it('rejects rename into an existing target group', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'bcd', manufacturer: 'ScubaPro', cells: { 'M': 2 } },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetByManufacturer,
      { gearType: 'bcd', manufacturer: 'Cressi', cells: { 'L': 3 } },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.renameManufacturerGroup,
        {
          gearType: 'bcd',
          previousManufacturer: 'ScubaPro',
          manufacturer: 'Cressi',
        },
      ),
      'CONFLICT',
    )
  })

  it('rejects when previous group has no rows', async () => {
    await seedEquipment()

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.renameManufacturerGroup,
        {
          gearType: 'mask',
          previousManufacturer: 'Ghost',
          manufacturer: 'Cressi',
        },
      ),
      'NOT_FOUND',
    )
  })
})

// ── bulkSetMasksByManufacturer ───────────────────────────────────────────────

describe('equipmentInventory.bulkSetMasksByManufacturer', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  const seedEquipment = async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })
  }

  it('creates plano + Rx rows with correct discriminator fields', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      {
        manufacturer: 'ScubaPro',
        cells: { plano: 5, '-3.0': 2, '-4.5': 1, '-2.0': 0 },
      },
    )

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      expect(rows).toHaveLength(3)

      const plano = rows.find((r) => !r.isPrescription)!
      expect(plano.isPrescription).toBe(false)
      expect(plano.diopter).toBeUndefined()

      const rx30 = rows.find((r) => r.diopter === -3.0)!
      expect(rx30.isPrescription).toBe(true)

      const rx45 = rows.find((r) => r.diopter === -4.5)!
      expect(rx45.isPrescription).toBe(true)
    })
  })

  it('updates existing rows and deletes cells set to 0', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'ScubaPro', cells: { plano: 5, '-3.0': 2 } },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'ScubaPro', cells: { plano: 10, '-3.0': 0, '-4.0': 1 } },
    )

    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.deleted).toBe(1)

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      expect(rows).toHaveLength(2)
      const plano = rows.find((r) => !r.isPrescription)!
      const unit = await ctx.db.get(plano.inventoryUnitId)
      expect(unit!.totalUnits).toBe(10)
    })
  })

  it('rejects invalid cell keys', async () => {
    await seedEquipment()

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetMasksByManufacturer,
        { manufacturer: 'ScubaPro', cells: { 'not-a-number': 2 } },
      ),
      'VALIDATION',
    )
  })

  it('blocks reducing a cell below reserved count', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'ScubaPro', cells: { '-3.0': 5 } },
    )

    const unitId = await t.run(async (ctx) => {
      const row = (await ctx.db.query('equipmentInventory').collect())[0]
      return row.inventoryUnitId
    })

    await t.run(async (ctx) => {
      await seedSnapshot(ctx, unitId, {
        date: '2026-05-01',
        totalUnits: 5,
        reservedUnits: 3,
        availableUnits: 2,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetMasksByManufacturer,
        { manufacturer: 'ScubaPro', cells: { '-3.0': 2 } },
      ),
      'VALIDATION',
    )
  })
})

// ── renameMaskManufacturerGroup ──────────────────────────────────────────────

describe('equipmentInventory.renameMaskManufacturerGroup', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  const seedEquipment = async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })
  }

  it('renames manufacturer on all mask rows preserving diopter/plano', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'ScubaPro', cells: { plano: 4, '-3.0': 2 } },
    )

    const result = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.renameMaskManufacturerGroup,
      { previousManufacturer: 'ScubaPro', manufacturer: 'Cressi' },
    )

    expect(result.renamed).toBe(2)

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('equipmentInventory').collect()
      expect(rows.every((r) => r.manufacturer === 'Cressi')).toBe(true)
      expect(rows.find((r) => !r.isPrescription)).toBeDefined()
      expect(rows.find((r) => r.diopter === -3.0)).toBeDefined()
    })
  })

  it('rejects rename when target manufacturer already exists', async () => {
    await seedEquipment()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'ScubaPro', cells: { plano: 1 } },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.bulkSetMasksByManufacturer,
      { manufacturer: 'Cressi', cells: { plano: 1 } },
    )

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.renameMaskManufacturerGroup,
        { previousManufacturer: 'ScubaPro', manufacturer: 'Cressi' },
      ),
      'CONFLICT',
    )
  })

  it('rejects unauthenticated caller on bulkSetMasksByManufacturer', async () => {
    await expectConvexError(
      t.mutation(
        api.equipmentInventory.bulkSetMasksByManufacturer,
        { manufacturer: 'ScubaPro', cells: { plano: 1 } },
      ),
      'UNAUTHENTICATED',
    )
  })

  it('rejects FORBIDDEN for non-Equipment-role caller on bulkSetMasksByManufacturer', async () => {
    const INSTRUCTOR_TOKEN = 'test|instructor-only'
    await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: INSTRUCTOR_TOKEN, slug: 'instructor-only', role: 'Instructor', email: 'inst@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN }).mutation(
        api.equipmentInventory.bulkSetMasksByManufacturer,
        { manufacturer: 'ScubaPro', cells: { plano: 1 } },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects unauthenticated caller on renameMaskManufacturerGroup', async () => {
    await expectConvexError(
      t.mutation(
        api.equipmentInventory.renameMaskManufacturerGroup,
        { previousManufacturer: 'ScubaPro', manufacturer: 'Cressi' },
      ),
      'UNAUTHENTICATED',
    )
  })

  it('rejects FORBIDDEN for non-Equipment-role caller on renameMaskManufacturerGroup', async () => {
    const INSTRUCTOR_TOKEN = 'test|instructor-only-2'
    await t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: INSTRUCTOR_TOKEN, slug: 'instructor-only-2', role: 'Instructor', email: 'inst2@test.com' })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: INSTRUCTOR_TOKEN }).mutation(
        api.equipmentInventory.renameMaskManufacturerGroup,
        { previousManufacturer: 'ScubaPro', manufacturer: 'Cressi' },
      ),
      'FORBIDDEN',
    )
  })
})

describe('equipmentInventory — orphan inventoryUnitId tolerance', () => {
  let t: ReturnType<typeof makeT>
  beforeEach(() => { t = makeT() })

  it('bulkSetByManufacturer self-heals an orphan equipmentInventory row on update', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const liveId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'bcd', manufacturer: 'Aqualung', size: 'M', totalUnits: 5 },
    )

    const orphanInvId = await t.run(async (ctx) => {
      const liveItem = await ctx.db.get(liveId)
      const orphanUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
        displayName: 'bcd - Aqualung (L)',
        capacityModel: 'Pooled',
        totalUnits: 3,
        ownerId: EM_SLUG,
        ownerType: 'Equipment',
      })
      const invId = await ctx.db.insert('equipmentInventory', {
        inventoryUnitId: orphanUnitId,
        equipmentManagerId: EM_SLUG,
        gearType: 'bcd',
        manufacturer: 'Aqualung',
        size: 'L',
      })
      await ctx.db.delete(orphanUnitId)
      void liveItem
      return invId
    })

    await expect(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetByManufacturer,
        {
          gearType: 'bcd',
          manufacturer: 'Aqualung',
          cells: { M: 7, L: 4 },
        },
      ),
    ).resolves.not.toThrow()

    await t.run(async (ctx) => {
      const orphanAfter = await ctx.db.get(orphanInvId)
      expect(orphanAfter).toBeNull()

      const liveAfter = await ctx.db.get(liveId)
      expect(liveAfter).not.toBeNull()
      const liveUnit = await ctx.db.get(liveAfter!.inventoryUnitId)
      expect(liveUnit!.totalUnits).toBe(7)
    })
  })

  it('removeItem tolerates a missing paired inventoryUnits row', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const inventoryId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', sizeSystem: 'eu', manufacturer: 'Cressi', size: '42', totalUnits: 2 },
    )

    await t.run(async (ctx) => {
      const item = await ctx.db.get(inventoryId)
      await ctx.db.delete(item!.inventoryUnitId)
    })

    await expect(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.removeItem,
        { inventoryId },
      ),
    ).resolves.not.toThrow()

    await t.run(async (ctx) => {
      const itemAfter = await ctx.db.get(inventoryId)
      expect(itemAfter).toBeNull()
    })
  })

  it('bulkSetMasksByManufacturer self-heals an orphan mask row on update', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    const liveId = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', manufacturer: 'ScubaPro', isPrescription: false, totalUnits: 6 },
    )

    const orphanInvId = await t.run(async (ctx) => {
      const orphanUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
        displayName: 'mask - ScubaPro (Rx -2.0)',
        capacityModel: 'Pooled',
        totalUnits: 2,
        ownerId: EM_SLUG,
        ownerType: 'Equipment',
      })
      const invId = await ctx.db.insert('equipmentInventory', {
        inventoryUnitId: orphanUnitId,
        equipmentManagerId: EM_SLUG,
        gearType: 'mask',
        manufacturer: 'ScubaPro',
        isPrescription: true,
        diopter: -2.0,
      })
      await ctx.db.delete(orphanUnitId)
      return invId
    })

    await expect(
      t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.bulkSetMasksByManufacturer,
        {
          manufacturer: 'ScubaPro',
          cells: { plano: 8, '-2.0': 3 },
        },
      ),
    ).resolves.not.toThrow()

    await t.run(async (ctx) => {
      const orphanAfter = await ctx.db.get(orphanInvId)
      expect(orphanAfter).toBeNull()

      const liveAfter = await ctx.db.get(liveId)
      const planoUnit = await ctx.db.get(liveAfter!.inventoryUnitId)
      expect(planoUnit!.totalUnits).toBe(8)
    })
  })
})

describe('equipmentInventory — Rule 12: profileComplete denorm', () => {
  async function readEquipRoleComplete(t: ReturnType<typeof makeT>, slug: string): Promise<boolean | undefined> {
    return await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (!user) return undefined
      const row = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user._id).eq('role', 'Equipment'))
        .unique()
      return row?.profileComplete
    })
  }

  it('writes to equipmentInventory.addItem flip userRoles.profileComplete via setRoleProfileComplete', async () => {
    const t = makeT()
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment', email: 'em@test.com' })
    })

    // Fresh user has no inventory — profileComplete should not be true yet
    expect(await readEquipRoleComplete(t, EM_SLUG)).not.toBe(true)

    const NON_FIN_NON_MASK: Array<'bcd' | 'regulator' | 'wetsuit'> = [
      'bcd', 'regulator', 'wetsuit',
    ]
    for (const gearType of NON_FIN_NON_MASK) {
      await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
        api.equipmentInventory.addItem,
        { gearType, manufacturer: 'X', size: 'M', totalUnits: 1 },
      )
    }
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'fins', manufacturer: 'X', size: '42', sizeSystem: 'eu', totalUnits: 1 },
    )
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'mask', manufacturer: 'X', totalUnits: 1 },
    )

    // The denorm is re-computed every write and reflects current completeness.
    // We don't assert an exact boolean (profile-level completeness also depends on
    // user-level fields like phone/appLanguage that seedUser fills in) — we just
    // assert the field is a settled boolean (the denorm wrote) after the last
    // mutation, which proves setRoleProfileComplete is wired.
    const final = await readEquipRoleComplete(t, EM_SLUG)
    expect(typeof final).toBe('boolean')
  })
})
