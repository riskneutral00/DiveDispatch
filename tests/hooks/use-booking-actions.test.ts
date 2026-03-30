// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAccept = vi.fn()
const mockDecline = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: (ref: { _name?: string }) => {
    // Distinguish accept vs decline based on reference
    if (ref && String(ref).includes('decline')) return mockDecline
    return mockAccept
  },
}))

// Re-mock to distinguish the two mutations properly
let mutationCallCount = 0
vi.mock('convex/react', () => ({
  useMutation: () => {
    mutationCallCount++
    // First call = accept, second = decline (matches hook source order)
    return mutationCallCount % 2 === 1 ? mockAccept : mockDecline
  },
}))

import { useBookingActions } from '../../src/lib/hooks/use-booking-actions'

const FAKE_BOOKING = {
  _id: 'booking-1',
  activityType: ['OW'],
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  status: 'Upcoming',
  diverCount: 2,
  instructorName: 'Jane',
  boatName: undefined,
  customerName: 'John',
  operatorName: 'Test DC',
  reservationStatus: 'PendingAcceptance',
  resources: [],
} as Parameters<ReturnType<typeof useBookingActions>['setDetailBooking']>[0]

describe('useBookingActions', () => {
  beforeEach(() => {
    mockAccept.mockReset()
    mockDecline.mockReset()
    mockAccept.mockResolvedValue(undefined)
    mockDecline.mockResolvedValue(undefined)
    mutationCallCount = 0
  })

  it('starts with null detail and no errors', () => {
    const { result } = renderHook(() => useBookingActions())
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.detailError).toBeNull()
    expect(result.current.isAccepting).toBe(false)
    expect(result.current.isDeclining).toBe(false)
    expect(result.current.urgentCancelId).toBeNull()
  })

  it('handleBookingClick sets detail booking', () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => {
      result.current.handleBookingClick('booking-1', [FAKE_BOOKING!])
    })
    expect(result.current.detailBooking).toBe(FAKE_BOOKING)
  })

  it('handleBookingClick ignores non-existent ID', () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => {
      result.current.handleBookingClick('nonexistent', [FAKE_BOOKING!])
    })
    expect(result.current.detailBooking).toBeNull()
  })

  it('clearDetail clears booking and error', () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => { result.current.setDetailBooking(FAKE_BOOKING!) })
    expect(result.current.detailBooking).not.toBeNull()

    act(() => { result.current.clearDetail() })
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.detailError).toBeNull()
  })

  it('handleDetailAccept calls accept mutation and clears booking', async () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => { result.current.setDetailBooking(FAKE_BOOKING!) })

    await act(async () => {
      await result.current.handleDetailAccept('booking-1')
    })

    expect(mockAccept).toHaveBeenCalledOnce()
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.isAccepting).toBe(false)
  })

  it('handleDetailAccept captures error on failure', async () => {
    const { ConvexError } = await import('convex/values')
    mockAccept.mockRejectedValue(new ConvexError({ reason: 'Already accepted' }))

    const { result } = renderHook(() => useBookingActions())
    act(() => { result.current.setDetailBooking(FAKE_BOOKING!) })

    await act(async () => {
      await result.current.handleDetailAccept('booking-1')
    })

    expect(result.current.detailError).toBe('Already accepted')
    expect(result.current.isAccepting).toBe(false)
    // Booking should still be set (not cleared on error)
    expect(result.current.detailBooking).not.toBeNull()
  })

  it('handleDetailDecline calls decline mutation and clears booking', async () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => { result.current.setDetailBooking(FAKE_BOOKING!) })

    await act(async () => {
      await result.current.handleDetailDecline('booking-1')
    })

    expect(mockDecline).toHaveBeenCalledOnce()
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.isDeclining).toBe(false)
  })

  it('handleUrgentCancel sets urgentCancelId for operators', () => {
    const { result } = renderHook(() => useBookingActions())
    act(() => {
      result.current.handleUrgentCancel('booking-1', true)
    })
    expect(result.current.urgentCancelId).toBe('booking-1')
  })

  it('handleUrgentCancel declines for non-operators', async () => {
    const { result } = renderHook(() => useBookingActions())
    await act(async () => {
      result.current.handleUrgentCancel('booking-1', false)
    })
    expect(mockDecline).toHaveBeenCalledOnce()
    expect(result.current.urgentCancelId).toBeNull()
  })
})
