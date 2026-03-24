import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser } from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

describe('users.me query', () => {
  it('returns null when authenticated but no user record exists', async () => {
    const t = makeT()
    // Auth identity set, but no user row inserted
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|ghost-user' })
      .query(api.users.me, {})

    expect(result).toBeNull()
  })

  it('returns user when record exists with matching tokenIdentifier', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'existing-dc', tokenIdentifier: 'clerk|existing-dc', role: 'DiveCenter' }))

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|existing-dc' })
      .query(api.users.me, {})

    expect(result).not.toBeNull()
    expect(result!.slug).toBe('existing-dc')
    expect(result!.role).toBe('DiveCenter')
  })

  it('returns null when unauthenticated', async () => {
    const t = makeT()
    // No identity at all
    const result = await t.query(api.users.me, {})

    expect(result).toBeNull()
  })
})
