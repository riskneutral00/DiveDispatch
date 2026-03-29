import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { restoreSnapshotUnits } from '../convex/bookings/_shared'
import type { Doc } from '../convex/_generated/dataModel'
import { ErrorCode } from '../convex/lib/errorCodes'
import {
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('restoreSnapshotUnits', () => {
  it('restores available and reserved counts', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 5 })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 3,
        reservedUnits: 2,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 1)

      const snapshot = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'> | null
      expect(snapshot).not.toBeNull()
      expect(snapshot!.availableUnits).toBe(4)
      expect(snapshot!.reservedUnits).toBe(1)
    })
  })

  it('clamps reservedUnits to zero when underflow would occur', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 5 })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 4,
        reservedUnits: 1,
      })

      // Release 3 units when only 1 is reserved — should clamp to 0
      await restoreSnapshotUnits(ctx, snapshotId, 3)

      const snapshot = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'> | null
      expect(snapshot).not.toBeNull()
      expect(snapshot!.availableUnits).toBe(7)
      expect(snapshot!.reservedUnits).toBe(0)
    })
  })

  it('handles zero units requested (no-op)', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 5 })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 3,
        reservedUnits: 2,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 0)

      const snapshot = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'> | null
      expect(snapshot).not.toBeNull()
      expect(snapshot!.availableUnits).toBe(3)
      expect(snapshot!.reservedUnits).toBe(2)
    })
  })

  it('restores multi-unit pool correctly', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 10 })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 10,
        availableUnits: 4,
        reservedUnits: 6,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 3)

      const snapshot = await ctx.db.get(snapshotId) as Doc<'availabilitySnapshots'> | null
      expect(snapshot).not.toBeNull()
      expect(snapshot!.availableUnits).toBe(7)
      expect(snapshot!.reservedUnits).toBe(3)
    })
  })

  it('throws MISSING_SNAPSHOT_ON_RELEASE when snapshot document is missing', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unit = await seedInventoryUnit(ctx, { totalUnits: 5 })
      // Create then delete to get a valid-format but non-existent ID
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 3,
        reservedUnits: 2,
      })
      await ctx.db.delete(snapshotId)

      await expect(
        restoreSnapshotUnits(ctx, snapshotId, 1),
      ).rejects.toMatchObject({
        data: {
          code: ErrorCode.MISSING_SNAPSHOT_ON_RELEASE,
          reason: expect.stringContaining(snapshotId),
        },
      })
    })
  })

  it('mutates only the targeted snapshot, leaving others unchanged', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
      const unitA = await seedInventoryUnit(ctx, { totalUnits: 5, displayName: 'Unit A' })
      const unitB = await seedInventoryUnit(ctx, { totalUnits: 5, displayName: 'Unit B' })
      const snapshotA = await seedSnapshot(ctx, unitA, {
        totalUnits: 5,
        availableUnits: 2,
        reservedUnits: 3,
      })
      const snapshotB = await seedSnapshot(ctx, unitB, {
        totalUnits: 5,
        availableUnits: 1,
        reservedUnits: 4,
        date: '2026-04-10',
      })

      await restoreSnapshotUnits(ctx, snapshotA, 2)

      const snapA = await ctx.db.get(snapshotA) as Doc<'availabilitySnapshots'> | null
      expect(snapA).not.toBeNull()
      expect(snapA!.availableUnits).toBe(4)
      expect(snapA!.reservedUnits).toBe(1)

      const snapB = await ctx.db.get(snapshotB) as Doc<'availabilitySnapshots'> | null
      expect(snapB).not.toBeNull()
      expect(snapB!.availableUnits).toBe(1)
      expect(snapB!.reservedUnits).toBe(4)
    })
  })
})

// ─── Anti-duplication guard ──────────────────────────────────────────────────

describe('anti-duplication guard', () => {
  it('snapshot restoration is not inlined outside _shared.ts', () => {
    const convexDir = path.resolve(__dirname, '../convex')

    // Get all .ts files in convex/ except _shared.ts (Node 20.12+ recursive readdirSync)
    const allEntries = readdirSync(convexDir, { recursive: true }) as string[]
    const allFiles = allEntries.filter((f) => f.endsWith('.ts'))
    const filesToCheck = allFiles.filter(
      (f: string) => !f.endsWith('_shared.ts') && !f.includes('_generated'),
    )

    const inlinePattern =
      /availableUnits:\s*snapshot\.availableUnits\s*\+/

    const violations: string[] = []
    for (const file of filesToCheck) {
      const content = readFileSync(path.join(convexDir, file), 'utf-8')
      if (inlinePattern.test(content)) {
        violations.push(file)
      }
    }

    expect(violations, `Inline snapshot restoration found in: ${violations.join(', ')}. Use restoreSnapshotUnits() from _shared.ts instead.`).toEqual([])
  })
})
