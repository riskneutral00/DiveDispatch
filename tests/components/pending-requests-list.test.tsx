// @vitest-environment jsdom
/**
 * PendingRequestsList — component behavior tests
 *
 * Tests:
 * 1. Renders empty state when requests array is empty
 * 2. Renders a request card with owner name and pending badge
 * 3. Calls acceptByBooking mutation on Accept click
 * 4. Calls declineByBooking mutation on Decline click
 * 5. Shows error alert when mutation throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { PendingRequestsList } from '@/components/booking/pending-requests-list'
import type { RequestItem } from '../../../convex/bookings'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAccept = vi.fn()
const mockDecline = vi.fn()

let mutationCallCount = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useMutation: () => {
      // First call → accept, second call → decline
      const call = mutationCallCount++
      return call % 2 === 0 ? mockAccept : mockDecline
    },
  }
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    _id: 'req-1',
    bookingId: 'booking-1',
    activityType: ['DSD'],
    dates: ['2026-04-10'],
    status: 'pending',
    ownerName: 'Coral Dive Center',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PendingRequestsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationCallCount = 0
  })

  it('shows empty state when requests array is empty', () => {
    render(<PendingRequestsList requests={[]} />)
    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument()
  })

  it('renders a request card with the owner name and pending badge', () => {
    render(<PendingRequestsList requests={[makeRequest()]} />)
    expect(screen.getByText('Coral Dive Center')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('calls acceptByBooking mutation with the bookingId on Accept click', async () => {
    mockAccept.mockResolvedValueOnce(undefined)

    render(<PendingRequestsList requests={[makeRequest()]} />)

    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    fireEvent.click(acceptBtn)

    await vi.waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith({ bookingId: 'booking-1' })
    })
  })

  it('calls declineByBooking mutation with the bookingId on Decline click', async () => {
    mockDecline.mockResolvedValueOnce(undefined)

    render(<PendingRequestsList requests={[makeRequest()]} />)

    const declineBtn = screen.getByRole('button', { name: /decline/i })
    fireEvent.click(declineBtn)

    await vi.waitFor(() => {
      expect(mockDecline).toHaveBeenCalledWith({ bookingId: 'booking-1' })
    })
  })

  it('shows an error alert when the accept mutation throws', async () => {
    mockAccept.mockRejectedValueOnce(new Error('Server error'))

    render(<PendingRequestsList requests={[makeRequest()]} />)

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/failed to accept/i)).toBeInTheDocument()
    })
  })
})
