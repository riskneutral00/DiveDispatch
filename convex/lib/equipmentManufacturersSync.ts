import type { MutationCtx } from '../_generated/server'

export async function syncManufacturersByGearType(
  ctx: MutationCtx,
  equipmentManagerId: string,
): Promise<void> {
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_slug', (q) => q.eq('slug', equipmentManagerId))
    .unique()
  if (!org) return

  const profiles = await ctx.db
    .query('equipment')
    .withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
    .collect() // bounded: per-org equipment row count
  const profile = profiles[0]
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
