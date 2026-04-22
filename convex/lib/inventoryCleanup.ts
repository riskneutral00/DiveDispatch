import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { safeDeleteIfExists } from './safeDbOps'

type OwnerType = Doc<'inventoryUnits'>['ownerType']

export async function cleanupInventoryForOwner(
  ctx: MutationCtx,
  ownerId: string,
  ownerType: OwnerType,
): Promise<{ units: number; reservations: number; snapshots: number }> {
  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q) =>
      q.eq('ownerId', ownerId).eq('ownerType', ownerType),
    )
    .collect() // bounded: owners hold O(1) inventory units, practically <5

  if (units.length === 0) return { units: 0, reservations: 0, snapshots: 0 }

  const [reservationSets, snapshotSets] = await Promise.all([
    Promise.all(
      units.map((unit) =>
        ctx.db
          .query('reservations')
          .withIndex('by_inventoryUnitId_status', (q) =>
            q.eq('inventoryUnitId', unit._id),
          )
          .collect(), // bounded: reservations per unit, bounded by unit lifetime
      ),
    ),
    Promise.all(
      units.map((unit) =>
        ctx.db
          .query('availabilitySnapshots')
          .withIndex('by_inventoryUnitId_date', (q) =>
            q.eq('inventoryUnitId', unit._id),
          )
          .collect(), // bounded: snapshots per unit, bounded by horizon
      ),
    ),
  ])
  const allReservations = reservationSets.flat()
  const allSnapshots = snapshotSets.flat()

  await Promise.all(allReservations.map((r) => safeDeleteIfExists(ctx, r._id)))
  await Promise.all(allSnapshots.map((s) => safeDeleteIfExists(ctx, s._id)))
  await Promise.all(units.map((u) => safeDeleteIfExists(ctx, u._id)))

  return { units: units.length, reservations: allReservations.length, snapshots: allSnapshots.length }
}
