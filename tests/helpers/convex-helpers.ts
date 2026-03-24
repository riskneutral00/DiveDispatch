import { convexTest } from 'convex-test'
import { expect } from 'vitest'
import schema from '../../convex/schema'

/**
 * Create a fresh convex-test instance.
 * Single source of truth — replaces per-file `makeT()` and `const modules` patterns.
 */
export function makeT() {
  return convexTest(schema, import.meta.glob('../../convex/**/*.ts'))
}

/**
 * Assert that a Convex mutation/query rejects with a ConvexError carrying the given code.
 * Handles both string-serialized and object `data` payloads.
 */
export async function expectConvexError(
  promise: Promise<unknown>,
  code: string,
) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return (data as Record<string, unknown>)?.code === code
  })
}
