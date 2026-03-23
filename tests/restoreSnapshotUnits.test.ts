import { describe, it, expect, beforeEach } from 'vitest'
import { convexTest } from 'convex-test'
import { readFileSync } from 'node:fs'
import schema from '../convex/schema'
import { restoreSnapshotUnits } from '../convex/bookings/_shared'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedInventoryUnit,
  seedSnapshot,
} from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')
let t = convexTest(schema, modules)
beforeEach(() => {
  t = convexTest(schema, modules)
})

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('restoreSnapshotUnits', () => {
  it('restores available and reserved counts', async () => {
    await t.run(async (ctx) => {
      const user = await seedUser(ctx, TEST_SLUGS.operator, TEST_TOKENS.operator)
      const unit = await seedInventoryUnit(ctx, user, {
        totalUnits: 5,
        ownerType: 'operator',
      })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 3,
        reservedUnits: 2,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 3, 2, 1)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(4)
      expect(snapshot!.reservedUnits).toBe(1)
    })
  })

  it('clamps reservedUnits to zero when underflow would occur', async () => {
    await t.run(async (ctx) => {
      const user = await seedUser(ctx, TEST_SLUGS.operator, TEST_TOKENS.operator)
      const unit = await seedInventoryUnit(ctx, user, {
        totalUnits: 5,
        ownerType: 'operator',
      })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 4,
        reservedUnits: 1,
      })

      // Release 3 units when only 1 is reserved — should clamp to 0
      await restoreSnapshotUnits(ctx, snapshotId, 4, 1, 3)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(7)
      expect(snapshot!.reservedUnits).toBe(0)
    })
  })

  it('handles zero units requested (no-op)', async () => {
    await t.run(async (ctx) => {
      const user = await seedUser(ctx, TEST_SLUGS.operator, TEST_TOKENS.operator)
      const unit = await seedInventoryUnit(ctx, user, {
        totalUnits: 5,
        ownerType: 'operator',
      })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 5,
        availableUnits: 3,
        reservedUnits: 2,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 3, 2, 0)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(3)
      expect(snapshot!.reservedUnits).toBe(2)
    })
  })

  it('restores multi-unit pool correctly', async () => {
    await t.run(async (ctx) => {
      const user = await seedUser(ctx, TEST_SLUGS.operator, TEST_TOKENS.operator)
      const unit = await seedInventoryUnit(ctx, user, {
        totalUnits: 10,
        ownerType: 'operator',
      })
      const snapshotId = await seedSnapshot(ctx, unit, {
        totalUnits: 10,
        availableUnits: 4,
        reservedUnits: 6,
      })

      await restoreSnapshotUnits(ctx, snapshotId, 4, 6, 3)

      const snapshot = await ctx.db.get(snapshotId)
      expect(snapshot!.availableUnits).toBe(7)
      expect(snapshot!.reservedUnits).toBe(3)
    })
  })
})

// ─── Anti-duplication guard ──────────────────────────────────────────────────

describe('anti-duplication guard', () => {
  it('snapshot restoration is not inlined outside _shared.ts', () => {
    const { globSync } = require('node:fs')
    const path = require('node:path')
    const convexDir = path.resolve(__dirname, '../convex')

    // Get all .ts files in convex/ except _shared.ts
    const allFiles: string[] = globSync('**/*.ts', { cwd: convexDir })
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
