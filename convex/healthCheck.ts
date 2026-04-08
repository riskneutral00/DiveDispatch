import { internalQuery } from './_generated/server'

export const ping = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query('users').first()
    return !!user
  },
})
