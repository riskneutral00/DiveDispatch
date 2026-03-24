import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

import { seedUser } from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

describe('users.me query', () => {
  it('returns null when authenticated but no user record exists', async () => {
    const t = convexTest(schema, modules)
    // Auth identity set, but no user row inserted
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|ghost-user' })
      .query(api.users.me, {})

    expect(result).toBeNull()
  })

  it('returns user when record exists with matching tokenIdentifier', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => seedUser(ctx, { slug: 'existing-dc', tokenIdentifier: 'clerk|existing-dc', role: 'DiveCenter' }))

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|existing-dc' })
      .query(api.users.me, {})

    expect(result).not.toBeNull()
    expect(result!.slug).toBe('existing-dc')
    expect(result!.role).toBe('DiveCenter')
  })

  it('returns null when unauthenticated', async () => {
    const t = convexTest(schema, modules)
    // No identity at all
    const result = await t.query(api.users.me, {})

    expect(result).toBeNull()
  })
})
