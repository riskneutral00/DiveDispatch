// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()
const mockCheckAndExpire = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => {
    mockUseMutation()
    return mockCheckAndExpire
  },
}))

import { useBookingWithExpiry } from '../../src/lib/hooks/use-booking-with-expiry'

describe('useBookingWithExpiry', () => {
  beforeEach(() => {
    mockUseQuery.mockReset()
    mockUseMutation.mockReset()
    mockCheckAndExpire.mockReset()
    mockCheckAndExpire.mockResolvedValue(undefined)
  })

  it('returns undefined booking while loading', () => {
    mockUseQuery.mockReturnValue(undefined)
    const { result } = renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(result.current.booking).toBeUndefined()
    expect(result.current.isExpired).toBe(false)
  })

  it('returns null booking when query returns null', () => {
    mockUseQuery.mockReturnValue(null)
    const { result } = renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(result.current.booking).toBeNull()
    expect(result.current.isExpired).toBe(false)
  })

  it('augments booking with isExpired=false for non-expired booking', () => {
    const booking = {
      _id: 'booking-1',
      status: 'Draft',
      expiresAt: Date.now() + 60000,
    }
    mockUseQuery.mockReturnValue(booking)
    const { result } = renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(result.current.booking).toBeTruthy()
    expect(result.current.booking!.isExpired).toBe(false)
    expect(result.current.isExpired).toBe(false)
  })

  it('augments booking with isExpired=true for expired draft', () => {
    const booking = {
      _id: 'booking-1',
      status: 'Draft',
      expiresAt: Date.now() - 60000,
    }
    mockUseQuery.mockReturnValue(booking)
    const { result } = renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(result.current.booking!.isExpired).toBe(true)
    expect(result.current.isExpired).toBe(true)
  })

  it('fires checkAndExpire for expired booking', () => {
    const booking = {
      _id: 'booking-1',
      status: 'Draft',
      expiresAt: Date.now() - 60000,
    }
    mockUseQuery.mockReturnValue(booking)
    renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(mockCheckAndExpire).toHaveBeenCalledOnce()
  })

  it('does not fire checkAndExpire for non-expired booking', () => {
    const booking = {
      _id: 'booking-1',
      status: 'Draft',
      expiresAt: Date.now() + 60000,
    }
    mockUseQuery.mockReturnValue(booking)
    renderHook(() => useBookingWithExpiry('booking-1' as never))
    expect(mockCheckAndExpire).not.toHaveBeenCalled()
  })

  it('isExpired is false for Upcoming status (even with old expiresAt)', () => {
    const booking = {
      _id: 'booking-1',
      status: 'Upcoming',
      expiresAt: Date.now() - 60000,
    }
    mockUseQuery.mockReturnValue(booking)
    const { result } = renderHook(() => useBookingWithExpiry('booking-1' as never))
    // isBookingExpired only applies to Draft status
    expect(result.current.isExpired).toBe(false)
  })
})
