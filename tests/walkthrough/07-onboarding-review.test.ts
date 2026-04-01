/**
 * @module-tag slow
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { MutationCtx } from '../../convex/_generated/server'
import { makeT } from '../helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(
  ctx: MutationCtx,
  slug: string,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} DC`,
    firstName: slug,
    lastName: 'Test',
    businessName: `${slug} Business`,
    isSeeded: false,
    appLanguage: 'en',
    ...overrides,
  })
}

// ─── Tests: users.completeOnboarding ─────────────────────────────────────────

describe('07: onboarding review — completeOnboarding mutation', () => {
  it('completeOnboarding sets onboardingComplete to true', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) =>
      seedUser(ctx, 'dc-complete-review', { name: 'Review DC' }),
    )

    await t
      .withIdentity({ tokenIdentifier: 'clerk|dc-complete-review' })
      .mutation(api.users.completeOnboarding, {})

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.onboardingComplete).toBe(true)
  })

  it('completeOnboarding rejects unauthenticated caller', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.users.completeOnboarding, {}),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('completeOnboarding rejects user with blank name', async () => {
    const t = makeT()
    await t.run(async (ctx) =>
      seedUser(ctx, 'dc-blank-name', { name: '' }),
    )

    await expect(
      t
        .withIdentity({ tokenIdentifier: 'clerk|dc-blank-name' })
        .mutation(api.users.completeOnboarding, {}),
    ).rejects.toMatchObject({ data: expect.stringContaining('VALIDATION') })
  })
})
