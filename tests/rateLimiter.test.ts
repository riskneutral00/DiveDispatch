import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { makeT } from './helpers/convex-helpers'
import { checkRateLimit } from '../convex/lib/rateLimiter'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

describe('checkRateLimit', () => {
  it('allows the first request', async () => {
    await t.run(async (ctx) => {
      await expect(
        checkRateLimit(ctx, 'submitSupportRequest', 'user-1'),
      ).resolves.toBeUndefined()
    })
  })

  it('allows requests up to the limit', async () => {
    await t.run(async (ctx) => {
      // submitSupportRequest allows 5 per minute
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-burst')
      }
    })
  })

  it('rejects the request that exceeds the limit with ConvexError RATE_LIMITED', async () => {
    await t.run(async (ctx) => {
      // submitSupportRequest allows 5 per minute — exhaust all 5
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-exceed')
      }
      // 6th call should throw a ConvexError with RATE_LIMITED code
      try {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-exceed')
        expect.fail('Expected ConvexError to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        expect((err as ConvexError<{ code: string }>).data.code).toBe('RATE_LIMITED')
      }
    })
  })

  it('uses separate buckets per key', async () => {
    await t.run(async (ctx) => {
      // Exhaust limit for key A
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'key-A')
      }
      // Key B should still work
      await expect(
        checkRateLimit(ctx, 'submitSupportRequest', 'key-B'),
      ).resolves.toBeUndefined()
    })
  })

  it('uses separate buckets per limit name', async () => {
    await t.run(async (ctx) => {
      // Exhaust submitSupportRequest (5 max)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'shared-key')
      }
      // savePortalContact (10 max) with same key should still work
      await expect(
        checkRateLimit(ctx, 'savePortalContact', 'shared-key'),
      ).resolves.toBeUndefined()
    })
  })

  it('refills tokens after the window passes', async () => {
    await t.run(async (ctx) => {
      // submitSupportRequest: 5 tokens / 60_000ms window
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-refill')
      }

      // Confirm we're rate limited
      try {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-refill')
        expect.fail('Expected ConvexError to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        expect((err as ConvexError<{ code: string }>).data.code).toBe('RATE_LIMITED')
      }

      // Advance time past the full refill window (60s)
      vi.setSystemTime(Date.now() + 61_000)

      // After the window, tokens should have refilled — request should succeed
      await expect(
        checkRateLimit(ctx, 'submitSupportRequest', 'user-refill'),
      ).resolves.toBeUndefined()
    })
  })

  it('partially refills tokens proportional to elapsed time', async () => {
    await t.run(async (ctx) => {
      // submitSupportRequest: 5 tokens / 60_000ms
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-partial')
      }

      // Advance time by 12s — enough to refill 1 token (5 tokens / 60s = 1 token per 12s)
      vi.setSystemTime(Date.now() + 13_000)

      // Should succeed (1 refilled token available)
      await expect(
        checkRateLimit(ctx, 'submitSupportRequest', 'user-partial'),
      ).resolves.toBeUndefined()

      // Should fail (token just consumed, not enough time for another refill)
      try {
        await checkRateLimit(ctx, 'submitSupportRequest', 'user-partial')
        expect.fail('Expected ConvexError to be thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ConvexError)
        expect((err as ConvexError<{ code: string }>).data.code).toBe('RATE_LIMITED')
      }
    })
  })
})
