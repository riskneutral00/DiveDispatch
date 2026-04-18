import type { MutationCtx } from '../_generated/server'

export async function syncManufacturersByGearType(
  ctx: MutationCtx,
  equipmentManagerId: string,
): Promise<void> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_slug', (q) => q.eq('slug', equipmentManagerId))
    .unique()
  if (!user) return

  const profile = await ctx.db
    .query('equipment')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique()
  if (!profile) return

  const inventory = await ctx.db
    .query('equipmentInventory')
    .withIndex('by_equipmentManagerId', (q) =>
      q.eq('equipmentManagerId', equipmentManagerId),
    )
    .take(500)

  const byType: Record<string, Set<string>> = {}
  for (const item of inventory) {
    if (!item.manufacturer) continue
    if (!byType[item.gearType]) byType[item.gearType] = new Set()
    byType[item.gearType].add(item.manufacturer)
  }

  const next: Record<string, string[]> = {}
  for (const [gearType, mfrSet] of Object.entries(byType)) {
    if (mfrSet.size > 0) next[gearType] = Array.from(mfrSet).sort()
  }

  await ctx.db.patch(profile._id, {
    manufacturersByGearType: Object.keys(next).length > 0 ? next : undefined,
  })
}
