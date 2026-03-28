// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { CalendarBooking } from '../../../../convex/bookings'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAccept = vi.fn<(args: { bookingId: string }) => Promise<void>>()
const mockDecline = vi.fn<(args: { bookingId: string }) => Promise<void>>()

// Hook calls useMutation twice per render: [0] acceptByBooking, [1] declineByBooking.
// Counter resets to 0 every even call so re-renders stay in sync.
let mutationCallCount = 0

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useMutation: () => {
      const idx = mutationCallCount % 2
      mutationCallCount++
      return idx === 0 ? mockAccept : mockDecline
    },
  }
})

// Import AFTER mocks are registered
import { useBookingActions } from '../use-booking-actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<CalendarBooking> = {}): CalendarBooking {
  return {
    _id: 'booking-1',
    activityType: ['OW'],
    startDate: '2026-04-01',
    endDate: '2026-04-03',
    status: 'Upcoming',
    diverCount: 2,
    instructorName: 'Jane',
    boatName: 'SeaStar',
    customerName: 'Alice',
    operatorName: 'DiveCo',
    reservationStatus: 'Confirmed',
    resources: [],
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useBookingActions', () => {
  beforeEach(() => {
    mutationCallCount = 0
    mockAccept.mockReset()
    mockDecline.mockReset()
    mockAccept.mockResolvedValue(undefined)
    mockDecline.mockResolvedValue(undefined)
  })

  // ── Initial state ───────────────────────────────────────────────────────────

  it('starts with idle state', () => {
    const { result } = renderHook(() => useBookingActions())

    expect(result.current.detailBooking).toBeNull()
    expect(result.current.detailError).toBeNull()
    expect(result.current.isAccepting).toBe(false)
    expect(result.current.isDeclining).toBe(false)
    expect(result.current.urgentCancelId).toBeNull()
  })

  // ── handleBookingClick ──────────────────────────────────────────────────────

  it('handleBookingClick sets detailBooking when booking is found', () => {
    const booking = makeBooking({ _id: 'b-42' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.handleBookingClick('b-42', [booking])
    })

    expect(result.current.detailBooking).toEqual(booking)
  })

  it('handleBookingClick does not set detailBooking when id is not in list', () => {
    const booking = makeBooking({ _id: 'b-42' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.handleBookingClick('b-999', [booking])
    })

    expect(result.current.detailBooking).toBeNull()
  })

  // ── clearDetail ─────────────────────────────────────────────────────────────

  it('clearDetail resets booking and error', () => {
    const booking = makeBooking()
    const { result } = renderHook(() => useBookingActions())

    // Set up a booking and an error
    act(() => {
      result.current.setDetailBooking(booking)
    })
    expect(result.current.detailBooking).not.toBeNull()

    act(() => {
      result.current.clearDetail()
    })

    expect(result.current.detailBooking).toBeNull()
    expect(result.current.detailError).toBeNull()
  })

  // ── handleDetailAccept ──────────────────────────────────────────────────────

  it('handleDetailAccept calls mutation and clears detailBooking on success', async () => {
    const booking = makeBooking({ _id: 'b-accept' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.setDetailBooking(booking)
    })

    await act(async () => {
      await result.current.handleDetailAccept('b-accept')
    })

    expect(mockAccept).toHaveBeenCalledWith({ bookingId: 'b-accept' })
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.isAccepting).toBe(false)
    expect(result.current.detailError).toBeNull()
  })

  it('handleDetailAccept sets isAccepting during mutation', async () => {
    let resolveAccept!: () => void
    mockAccept.mockImplementation(
      () => new Promise<void>((resolve) => { resolveAccept = resolve }),
    )

    const { result } = renderHook(() => useBookingActions())

    let acceptPromise: Promise<void>
    act(() => {
      acceptPromise = result.current.handleDetailAccept('b-1')
    })

    // During mutation
    expect(result.current.isAccepting).toBe(true)

    await act(async () => {
      resolveAccept()
      await acceptPromise!
    })

    // After mutation
    expect(result.current.isAccepting).toBe(false)
  })

  it('handleDetailAccept captures Error message on failure', async () => {
    mockAccept.mockRejectedValue(new Error('Inventory conflict'))
    const booking = makeBooking({ _id: 'b-fail' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.setDetailBooking(booking)
    })

    await act(async () => {
      await result.current.handleDetailAccept('b-fail')
    })

    expect(result.current.detailError).toBe('Inventory conflict')
    expect(result.current.isAccepting).toBe(false)
    // Booking stays open on error so user can see the message
    expect(result.current.detailBooking).not.toBeNull()
  })

  it('handleDetailAccept uses fallback message for non-Error throws', async () => {
    mockAccept.mockRejectedValue('string-error')

    const { result } = renderHook(() => useBookingActions())

    await act(async () => {
      await result.current.handleDetailAccept('b-1')
    })

    expect(result.current.detailError).toBe('Failed to accept booking')
  })

  it('handleDetailAccept clears previous error on success', async () => {
    // First call: fail
    mockAccept.mockRejectedValueOnce(new Error('first error'))
    const { result } = renderHook(() => useBookingActions())

    await act(async () => {
      await result.current.handleDetailAccept('b-1')
    })
    expect(result.current.detailError).toBe('first error')

    // Second call: succeed
    mockAccept.mockResolvedValueOnce(undefined)
    await act(async () => {
      await result.current.handleDetailAccept('b-1')
    })
    expect(result.current.detailError).toBeNull()
  })

  // ── handleDetailDecline ─────────────────────────────────────────────────────

  it('handleDetailDecline calls mutation and clears detailBooking on success', async () => {
    const booking = makeBooking({ _id: 'b-decline' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.setDetailBooking(booking)
    })

    await act(async () => {
      await result.current.handleDetailDecline('b-decline')
    })

    expect(mockDecline).toHaveBeenCalledWith({ bookingId: 'b-decline' })
    expect(result.current.detailBooking).toBeNull()
    expect(result.current.isDeclining).toBe(false)
    expect(result.current.detailError).toBeNull()
  })

  it('handleDetailDecline sets isDeclining during mutation', async () => {
    let resolveDecline!: () => void
    mockDecline.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDecline = resolve }),
    )

    const { result } = renderHook(() => useBookingActions())

    let declinePromise: Promise<void>
    act(() => {
      declinePromise = result.current.handleDetailDecline('b-1')
    })

    expect(result.current.isDeclining).toBe(true)

    await act(async () => {
      resolveDecline()
      await declinePromise!
    })

    expect(result.current.isDeclining).toBe(false)
  })

  it('handleDetailDecline captures Error message on failure', async () => {
    mockDecline.mockRejectedValue(new Error('Cannot decline confirmed'))
    const booking = makeBooking({ _id: 'b-fail' })
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.setDetailBooking(booking)
    })

    await act(async () => {
      await result.current.handleDetailDecline('b-fail')
    })

    expect(result.current.detailError).toBe('Cannot decline confirmed')
    expect(result.current.isDeclining).toBe(false)
    expect(result.current.detailBooking).not.toBeNull()
  })

  it('handleDetailDecline uses fallback message for non-Error throws', async () => {
    mockDecline.mockRejectedValue(42)

    const { result } = renderHook(() => useBookingActions())

    await act(async () => {
      await result.current.handleDetailDecline('b-1')
    })

    expect(result.current.detailError).toBe('Failed to decline booking')
  })

  // ── handleUrgentCancel ──────────────────────────────────────────────────────

  it('handleUrgentCancel sets urgentCancelId when caller is operator', () => {
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.handleUrgentCancel('b-urgent', true)
    })

    expect(result.current.urgentCancelId).toBe('b-urgent')
    // Should NOT call decline for operators
    expect(mockDecline).not.toHaveBeenCalled()
  })

  it('handleUrgentCancel calls decline when caller is not operator', async () => {
    const { result } = renderHook(() => useBookingActions())

    await act(async () => {
      result.current.handleUrgentCancel('b-resource', false)
    })

    // Non-operators go through the decline path
    expect(mockDecline).toHaveBeenCalledWith({ bookingId: 'b-resource' })
    expect(result.current.urgentCancelId).toBeNull()
  })

  // ── setUrgentCancelId ───────────────────────────────────────────────────────

  it('setUrgentCancelId can be cleared by passing null', () => {
    const { result } = renderHook(() => useBookingActions())

    act(() => {
      result.current.setUrgentCancelId('b-1')
    })
    expect(result.current.urgentCancelId).toBe('b-1')

    act(() => {
      result.current.setUrgentCancelId(null)
    })
    expect(result.current.urgentCancelId).toBeNull()
  })
})
