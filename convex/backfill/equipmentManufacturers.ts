import { ConvexError } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { ErrorCode } from '../lib/errorCodes'
import { isDevEnvironment } from '../lib/devGuard'
import { syncManufacturersByGearType } from '../lib/equipmentManufacturersSync'

export const backfillEquipmentManufacturers = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevEnvironment()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'dev_only' })
    }

    const inventory = await ctx.db.query('equipmentInventory').take(5000)
    const managerIds = [...new Set(inventory.map((r) => r.equipmentManagerId))]

    const results: Array<{ equipmentManagerId: string; synced: boolean }> = []
    for (const mid of managerIds) {
      await syncManufacturersByGearType(ctx, mid)
      results.push({ equipmentManagerId: mid, synced: true })
    }
    return results
  },
})
