import { describe, it, expect, vi, afterEach } from 'vitest'
import { isBookingExpired } from '../convex/shared/bookingExpiry'

describe('isBookingExpired', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for a Draft booking past its expiresAt', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Draft', expiresAt: 500 })).toBe(true)
  })

  it('returns false for a Draft booking not yet expired', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Draft', expiresAt: 2000 })).toBe(false)
  })

  it('returns false for a Draft booking expiring exactly now', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Draft', expiresAt: 1000 })).toBe(false)
  })

  it('returns false for an Upcoming booking even if expiresAt is past', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Upcoming', expiresAt: 500 })).toBe(false)
  })

  it('returns false for a Completed booking even if expiresAt is past', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Completed', expiresAt: 500 })).toBe(false)
  })

  it('returns false for a Cancelled booking even if expiresAt is past', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    expect(isBookingExpired({ status: 'Cancelled', expiresAt: 500 })).toBe(false)
  })

  it('returns false for a Draft booking with null expiresAt', () => {
    expect(isBookingExpired({ status: 'Draft', expiresAt: null })).toBe(false)
  })

  it('returns false for a Draft booking with undefined expiresAt', () => {
    expect(isBookingExpired({ status: 'Draft', expiresAt: undefined })).toBe(false)
  })

  it('returns false for a Draft booking with no expiresAt field', () => {
    expect(isBookingExpired({ status: 'Draft' })).toBe(false)
  })
})
