import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { RESERVATION_STATUS } from '../convex/shared/statuses'
import { ErrorCode } from '../convex/lib/errorCodes'

// ── isActiveReservation ──────────────────────────────────────────────────────

import { isActiveReservation } from '../convex/bookings/_shared'

describe('isActiveReservation', () => {
  it('returns true for PendingAcceptance', () => {
    expect(isActiveReservation({ status: RESERVATION_STATUS.PendingAcceptance })).toBe(true)
  })

  it('returns true for Confirmed', () => {
    expect(isActiveReservation({ status: RESERVATION_STATUS.Confirmed })).toBe(true)
  })

  it('returns false for Vacated', () => {
    expect(isActiveReservation({ status: RESERVATION_STATUS.Vacated })).toBe(false)
  })

  it('returns false for NoShow', () => {
    expect(isActiveReservation({ status: RESERVATION_STATUS.NoShow })).toBe(false)
  })
})

// ── assertOwnership ──────────────────────────────────────────────────────────

import { assertOwnership } from '../convex/lib/auth'

describe('assertOwnership', () => {
  it('does not throw when ownerId matches user.slug', () => {
    expect(() =>
      assertOwnership({ ownerId: 'alice' }, { slug: 'alice' }),
    ).not.toThrow()
  })

  it('throws FORBIDDEN when ownerId does not match user.slug', () => {
    expect(() =>
      assertOwnership({ ownerId: 'alice' }, { slug: 'bob' }),
    ).toThrow()
  })

  it('throws a ConvexError with ErrorCode.FORBIDDEN', () => {
    try {
      assertOwnership({ ownerId: 'alice' }, { slug: 'bob' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string }>).data
      expect(data.code).toBe(ErrorCode.FORBIDDEN)
    }
  })

  it('includes custom error message when provided', () => {
    try {
      assertOwnership({ ownerId: 'alice' }, { slug: 'bob' }, 'Custom denial')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; reason?: string }>).data
      expect(data.reason).toBe('Custom denial')
    }
  })
})
