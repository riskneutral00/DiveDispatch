import { describe, it, expect } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { safePatchIfExists, safeDeleteIfExists } from '../../convex/lib/safeDbOps'
import { makeT } from '../helpers/convex-helpers'

describe('safePatchIfExists', () => {
  it('patches an existing document and returns true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgId = await ctx.db.insert('organizations', {
        slug: 'safe-patch-ok',
        name: 'Original Name',
        createdAt: now,
        updatedAt: now,
      })

      const result = await safePatchIfExists(ctx, orgId, { name: 'Patched Name' })

      expect(result).toBe(true)
      const after = await ctx.db.get(orgId)
      expect(after?.name).toBe('Patched Name')
    })
  })

  it('returns false and does not throw for a missing doc ID', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgId = await ctx.db.insert('organizations', {
        slug: 'safe-patch-missing',
        name: 'To Be Deleted',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.delete(orgId)

      const result = await safePatchIfExists(ctx, orgId, { name: 'Should Not Apply' })

      expect(result).toBe(false)
    })
  })
})

describe('safeDeleteIfExists', () => {
  it('deletes an existing document and returns true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgId = await ctx.db.insert('organizations', {
        slug: 'safe-delete-ok',
        name: 'Will Be Deleted',
        createdAt: now,
        updatedAt: now,
      })

      const result = await safeDeleteIfExists(ctx, orgId)

      expect(result).toBe(true)
      const after = await ctx.db.get(orgId)
      expect(after).toBeNull()
    })
  })

  it('returns false and does not throw for a missing doc ID', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const orgId = await ctx.db.insert('organizations', {
        slug: 'safe-delete-missing',
        name: 'Already Gone',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.delete(orgId)

      const result = await safeDeleteIfExists(ctx, orgId as Id<'organizations'>)

      expect(result).toBe(false)
    })
  })
})
