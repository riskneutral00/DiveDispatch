/**
 * Inventory seed helpers for convex-test integration tests.
 */

import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { SeedCtx } from './seedUsers'
import { TEST_SLUGS } from '../helpers/testData'
import { testDate } from '../helpers/dates'

export async function seedInventoryUnit(
  ctx: SeedCtx,
  overrides: {
    resourceType?: Doc<'inventoryUnits'>['resourceType']
    displayName?: string
    capacityModel?: 'Exclusive' | 'Pooled'
    totalUnits?: number
    ownerId?: string
    ownerType?: Doc<'inventoryUnits'>['ownerType']
  } = {},
) {
  const resourceType = overrides.resourceType ?? 'Instructor'
  const ownerId = overrides.ownerId ?? TEST_SLUGS.instructor
  const ownerType = overrides.ownerType ?? resourceType
  return ctx.db.insert('inventoryUnits', {
    resourceType,
    resourceId: ownerId,
    displayName: overrides.displayName ?? 'John Doe',
    capacityModel: overrides.capacityModel ?? 'Exclusive',
    totalUnits: overrides.totalUnits ?? 1,
    ownerId,
    ownerType,
  })
}

export async function seedSnapshot(
  ctx: SeedCtx,
  inventoryUnitId: Id<'inventoryUnits'>,
  overrides: {
    date?: string
    windowStart?: string
    windowEnd?: string
    totalUnits?: number
    reservedUnits?: number
    availableUnits?: number
  } = {},
) {
  const totalUnits = overrides.totalUnits ?? 1
  const reservedUnits = overrides.reservedUnits ?? 0
  const availableUnits = overrides.availableUnits ?? totalUnits - reservedUnits
  return ctx.db.insert('availabilitySnapshots', {
    inventoryUnitId,
    date: overrides.date ?? testDate(5),
    windowStart: overrides.windowStart ?? '08:00',
    windowEnd: overrides.windowEnd ?? '16:00',
    totalUnits,
    reservedUnits,
    availableUnits,
  })
}
