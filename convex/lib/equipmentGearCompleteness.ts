import type { QueryCtx } from '../_generated/server'
import { GEAR_TYPES, type GearType } from '../shared/gearSizing'
import { isGearItemComplete } from '../shared/gearRequiredFields'

export async function evaluateGearInventoryCompleteness(
  ctx: QueryCtx,
  equipmentManagerSlug: string,
): Promise<GearType[]> {
  const rows = await ctx.db
    .query('equipmentInventory')
    .withIndex('by_equipmentManagerId', (q) => q.eq('equipmentManagerId', equipmentManagerSlug))
    .collect() // bounded: one EM's inventory, ≤500 rows in v0.1

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const unit = await ctx.db.get(r.inventoryUnitId)
      return { ...r, totalUnits: unit?.totalUnits ?? 0 }
    }),
  )

  const incomplete: GearType[] = []
  for (const gt of GEAR_TYPES) {
    const itemsForType = enriched.filter((r) => r.gearType === gt)
    if (itemsForType.length === 0) {
      incomplete.push(gt)
      continue
    }
    const anyComplete = itemsForType.some((item) => isGearItemComplete(item, gt))
    if (!anyComplete) incomplete.push(gt)
  }
  return incomplete
}
