// @vitest-environment jsdom
/**
 * CancelBookingDialog — component behavior tests
 *
 * Tests:
 * 1. Renders nothing when closed
 * 2. Renders title + description when open
 * 3. Renders reason textarea
 * 4. Calls cancelBooking mutation on confirm click
 * 5. Calls onSuccess and onClose after successful cancel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { CancelBookingDialog } from '@/components/booking/cancel-booking-dialog'
import type { Id } from '@/lib/convex-generated'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCancelBooking = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useMutation: () => mockCancelBooking,
  }
})

// jsdom doesn't implement HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BOOKING_ID = 'booking-abc' as Id<'bookings'>

function renderDialog(props: Partial<{
  open: boolean
  onClose: () => void
  onSuccess: () => void
}> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSuccess = props.onSuccess ?? vi.fn()
  return render(
    <CancelBookingDialog
      open={props.open ?? true}
      onClose={onClose}
      bookingId={BOOKING_ID}
      onSuccess={onSuccess}
    />,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CancelBookingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Cancel booking')).toBeNull()
  })

  it('renders the title and description when open', () => {
    renderDialog({ open: true })
    expect(screen.getByText('Cancel booking')).toBeInTheDocument()
    expect(
      screen.getByText(/This will release all reservations/),
    ).toBeInTheDocument()
  })

  it('renders the reason textarea', () => {
    renderDialog()
    expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument()
  })

  it('calls the cancelBooking mutation with the bookingId on confirm', async () => {
    mockCancelBooking.mockResolvedValueOnce(undefined)

    renderDialog()

    // Confirm button label is "Cancel" (the action label in the dialog)
    const confirmBtn = screen.getByRole('button', { name: /^cancel$/i, hidden: true })
    fireEvent.click(confirmBtn)

    // Mutation is called asynchronously — wait for microtasks
    await vi.waitFor(() => {
      expect(mockCancelBooking).toHaveBeenCalledWith({ bookingId: BOOKING_ID })
    })
  })

  it('calls onSuccess and onClose after a successful cancellation', async () => {
    mockCancelBooking.mockResolvedValueOnce(undefined)

    const onClose = vi.fn()
    const onSuccess = vi.fn()
    renderDialog({ onClose, onSuccess })

    const confirmBtn = screen.getByRole('button', { name: /^cancel$/i, hidden: true })
    fireEvent.click(confirmBtn)

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
