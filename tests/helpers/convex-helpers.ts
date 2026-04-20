import { convexTest } from 'convex-test'
import { expect } from 'vitest'
import schema from '../../convex/schema'

export function makeT() {
  return convexTest(schema, import.meta.glob('../../convex/**/*.ts'))
}

export type OrgIdentity = {
  tokenIdentifier: string
  orgId: string
  orgRole: 'admin' | 'member'
  orgSlug: string
}

export function orgIdentityFor(
  slug: string,
  orgRole: 'admin' | 'member' = 'admin',
): OrgIdentity {
  return {
    tokenIdentifier: `clerk|${slug}`,
    orgId: `test_${slug}`,
    orgRole,
    orgSlug: slug,
  }
}

export async function expectConvexError(
  promise: Promise<unknown>,
  code: string,
  reason?: string,
) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const e = err as { data: unknown }
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    const d = data as Record<string, unknown>
    if (d?.code !== code) return false
    if (reason !== undefined && d?.reason !== reason) return false
    return true
  })
}
