/**
 * Security: Input Sanitization
 *
 * Verifies that user-supplied string fields don't allow XSS, script injection,
 * or other dangerous content to be stored and returned by the backend.
 *
 * Convex stores data as-is (no server-side sanitization) — XSS prevention
 * relies on React's JSX escaping. These tests verify that dangerous payloads
 * are at minimum stored without causing backend errors, and document the
 * attack surface for client-side output encoding review.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedBooking,
} from '../fixtures/seedFixture'
import { testDate } from '../helpers/dates'
import { makeT } from '../helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ── XSS payloads ─────────────────────────────────────────────────────────────

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'; DROP TABLE users; --",
  '{{constructor.constructor("return this")()}}',
  '<iframe src="javascript:alert(1)">',
  'javascript:alert(1)',
]

const UNICODE_EDGE_CASES = [
  '\u0000', // null byte
  '\u200B', // zero-width space
  '\u202E', // right-to-left override
  'A'.repeat(10000), // extremely long string
  '🤿'.repeat(500), // emoji flood
]

describe('Input sanitization — XSS payloads in user fields', () => {
  it('stores XSS payloads in user businessName without error', async () => {
    for (const payload of XSS_PAYLOADS) {
      const t = makeT()
      await t.run(async (ctx) => {
        const userId = await seedUser(ctx, {
          businessName: payload,
          slug: `xss-${Math.random().toString(36).slice(2, 8)}`,
          tokenIdentifier: `test|xss-${Math.random().toString(36).slice(2, 8)}`,
        })
        const user = await ctx.db.get(userId)
        expect(user?.businessName).toBe(payload)
      })
    }
  })

  it('stores Unicode edge cases in user fields without error', async () => {
    for (const payload of UNICODE_EDGE_CASES) {
      const t = makeT()
      await t.run(async (ctx) => {
        const slug = `uni-${Math.random().toString(36).slice(2, 8)}`
        const userId = await seedUser(ctx, {
          businessName: payload,
          name: payload,
          slug,
          tokenIdentifier: `test|${slug}`,
        })
        const user = await ctx.db.get(userId)
        expect(user?.businessName).toBe(payload)
      })
    }
  })
})

describe('Input sanitization — XSS payloads in booking fields', () => {
  it('stores XSS payloads in booking draftState without error', async () => {
    for (const payload of XSS_PAYLOADS.slice(0, 3)) {
      const t = makeT()
      await t.run(async (ctx) => {
        await seedUser(ctx)
        const bookingId = await seedBooking(ctx, TEST_SLUGS.diveCenter, {
          status: 'Draft',
        })
        // Store payload in draftState (JSON string field)
        await ctx.db.patch(bookingId, { draftState: JSON.stringify({ notes: payload }) })
        const booking = await ctx.db.get(bookingId)
        const parsed = JSON.parse(booking!.draftState!)
        expect(parsed.notes).toBe(payload)
      })
    }
  })
})

describe('Input sanitization — SQL injection patterns (no-op in Convex but documented)', () => {
  it('SQL injection in string fields is harmless (Convex is not SQL)', async () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; DELETE FROM bookings WHERE 1=1",
      "UNION SELECT * FROM users --",
    ]

    for (const payload of sqlPayloads) {
      const t = makeT()
      await t.run(async (ctx) => {
        const slug = `sql-${Math.random().toString(36).slice(2, 8)}`
        const userId = await seedUser(ctx, {
          businessName: payload,
          slug,
          tokenIdentifier: `test|${slug}`,
        })
        const user = await ctx.db.get(userId)
        // Convex is document-based — SQL injection is a no-op
        // But we verify the payload doesn't cause unexpected behavior
        expect(user?.businessName).toBe(payload)
      })
    }
  })
})

describe('Input sanitization — field length boundaries', () => {
  it('accepts maximum reasonable field lengths', async () => {
    await t.run(async (ctx) => {
      const longName = 'A'.repeat(500) // Reasonable max for a business name
      const userId = await seedUser(ctx, {
        businessName: longName,
        slug: 'long-name-test',
        tokenIdentifier: 'test|long-name-test',
      })
      const user = await ctx.db.get(userId)
      expect(user?.businessName).toBe(longName)
      expect(user?.businessName?.length).toBe(500)
    })
  })
})
