/**
 * Stakeholder Hierarchy — Integration Tests
 *
 * Tests getManagedChildren and getManagedParent queries.
 * These control parent/child dashboard access — security-adjacent.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedHierarchy(
  ctx: Ctx,
  parentSlug: string,
  parentType: string,
  childSlug: string,
  childType: string,
) {
  await ctx.db.insert('stakeholderHierarchy', {
    parentSlug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentType: parentType as any,
    childSlug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    childType: childType as any,
    createdAt: Date.now(),
  })
}

// ─── getManagedChildren ──────────────────────────────────────────────────────

describe('getManagedChildren', () => {
  it('returns empty array when no hierarchy rows exist', async () => {
    const t = makeT()
    const result = await t.query(api.stakeholderHierarchy.getManagedChildren, {
      parentSlug: 'no-parent',
    })
    expect(result).toEqual([])
  })

  it('returns managed children with slug, type, and businessName', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx) // DC parent
      await seedUser(ctx, {
        tokenIdentifier: 'test|boat-child',
        slug: 'boat-child',
        role: 'Boat',
        businessName: 'Fast Boat Co',
      })
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-child', 'Boat')
    })

    const result = await t.query(api.stakeholderHierarchy.getManagedChildren, {
      parentSlug: TEST_SLUGS.diveCenter,
    })

    expect(result).toHaveLength(1)
    expect(result[0].childSlug).toBe('boat-child')
    expect(result[0].childType).toBe('Boat')
    expect(result[0].childName).toBe('Fast Boat Co')
  })

  it('filters to managed types only (Boat, Equipment, Pool, Compressor)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx) // DC parent
      // Managed types
      await seedUser(ctx, { tokenIdentifier: 'test|boat-1', slug: 'boat-1', role: 'Boat', businessName: 'Boat' })
      await seedUser(ctx, { tokenIdentifier: 'test|equip-1', slug: 'equip-1', role: 'Equipment', businessName: 'Equip' })
      await seedUser(ctx, { tokenIdentifier: 'test|pool-1', slug: 'pool-1', role: 'Pool', businessName: 'Pool' })
      await seedUser(ctx, { tokenIdentifier: 'test|comp-1', slug: 'comp-1', role: 'Compressor', businessName: 'Comp' })

      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-1', 'Boat')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'equip-1', 'Equipment')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'pool-1', 'Pool')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'comp-1', 'Compressor')
    })

    const result = await t.query(api.stakeholderHierarchy.getManagedChildren, {
      parentSlug: TEST_SLUGS.diveCenter,
    })

    expect(result).toHaveLength(4)
    const types = result.map((c: { childType: string }) => c.childType).sort()
    expect(types).toEqual(['Boat', 'Compressor', 'Equipment', 'Pool'])
  })

  it('excludes Instructor and DiveMaster children', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx) // DC parent
      await seedUser(ctx, { tokenIdentifier: 'test|instr-x', slug: 'instr-x', role: 'Instructor', businessName: 'Instr' })
      await seedUser(ctx, { tokenIdentifier: 'test|dm-x', slug: 'dm-x', role: 'DiveMaster', businessName: 'DM' })
      await seedUser(ctx, { tokenIdentifier: 'test|boat-ok', slug: 'boat-ok', role: 'Boat', businessName: 'Boat' })

      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'instr-x', 'Instructor')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'dm-x', 'DiveMaster')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-ok', 'Boat')
    })

    const result = await t.query(api.stakeholderHierarchy.getManagedChildren, {
      parentSlug: TEST_SLUGS.diveCenter,
    })

    expect(result).toHaveLength(1)
    expect(result[0].childSlug).toBe('boat-ok')
  })

  it('returns multiple children of same type', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, { tokenIdentifier: 'test|boat-a', slug: 'boat-a', role: 'Boat', businessName: 'Boat A' })
      await seedUser(ctx, { tokenIdentifier: 'test|boat-b', slug: 'boat-b', role: 'Boat', businessName: 'Boat B' })

      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-a', 'Boat')
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-b', 'Boat')
    })

    const result = await t.query(api.stakeholderHierarchy.getManagedChildren, {
      parentSlug: TEST_SLUGS.diveCenter,
    })

    expect(result).toHaveLength(2)
    const slugs = result.map((c: { childSlug: string }) => c.childSlug).sort()
    expect(slugs).toEqual(['boat-a', 'boat-b'])
  })
})

// ─── getManagedParent ────────────────────────────────────────────────────────

describe('getManagedParent', () => {
  it('returns null when no hierarchy row exists for child', async () => {
    const t = makeT()
    const result = await t.query(api.stakeholderHierarchy.getManagedParent, {
      childSlug: 'orphan-child',
    })
    expect(result).toBeNull()
  })

  it('returns parent info with slug, type, and businessName', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { businessName: 'Blue Ocean Diving' })
      await seedUser(ctx, { tokenIdentifier: 'test|boat-child', slug: 'boat-child', role: 'Boat' })
      await seedHierarchy(ctx, TEST_SLUGS.diveCenter, 'DiveCenter', 'boat-child', 'Boat')
    })

    const result = await t.query(api.stakeholderHierarchy.getManagedParent, {
      childSlug: 'boat-child',
    })

    expect(result).not.toBeNull()
    expect(result!.parentSlug).toBe(TEST_SLUGS.diveCenter)
    expect(result!.parentType).toBe('DiveCenter')
    expect(result!.parentName).toBe('Blue Ocean Diving')
  })
})
