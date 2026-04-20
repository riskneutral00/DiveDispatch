import { internalMutation } from '../_generated/server'

export const backfillDiveStaffName = internalMutation({
  args: {},
  handler: async () => {
    return { total: 0, patched: 0, skipped: 0 }
  },
})
