import { describe, it, expect, beforeEach } from 'vitest'
import {
  _generateUploadUrlHandler,
} from '../convex/support'
import { TEST_TOKENS, seedUser } from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── generateUploadUrl ────────────────────────────────────────────────────────

describe('generateUploadUrl', () => {
  it('returns an upload URL string when authenticated', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const url = await _generateUploadUrlHandler(ctx)
      expect(typeof url).toBe('string')
      expect(url.length).toBeGreaterThan(0)
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(_generateUploadUrlHandler(ctx)).rejects.toMatchObject({
        data: { code: 'UNAUTHENTICATED' },
      })
    })
  })
})
