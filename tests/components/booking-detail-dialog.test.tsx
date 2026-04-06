// @vitest-environment jsdom
/**
 * Tests for BookingDetailDialog.
 *
 * 1. Renders nothing (closed) when bookingId is null
 * 2. Shows skeleton while query is loading
 * 3. Shows empty state when booking is not found
 * 4. Renders booking status and course label when loaded
 * 5. Clicking "Discard" triggers discardDraft mutation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../helpers/render'
import { BookingDetailDialog } from '@/components/booking/booking-detail-dialog'

// ── jsdom polyfill for HTMLDialogElement ───────────────────────────────────────
// jsdom doesn't implement showModal/close — patch once at module scope
HTMLDialogElement.prototype.show ??= function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open') }

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}))

const mockDiscardDraft = vi.fn()
let mockBooking: unknown = undefined
let mockPortalLink: unknown = undefined
let qIdx = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: () => {
      if (qIdx >= 2) qIdx = 0
      const idx = qIdx++
      if (idx === 0) return mockBooking
      return mockPortalLink
    },
    useMutation: () => mockDiscardDraft,
  }
})

// Stub heavy child components that make their own queries
vi.mock('@/components/booking/audit-trail-table', () => ({
  AuditTrailTable: () => <div data-testid="audit-trail-stub" />,
}))
vi.mock('@/components/booking/cancel-booking-dialog', () => ({
  CancelBookingDialog: () => <div data-testid="cancel-dialog-stub" />,
}))
vi.mock('@/components/booking/reservation-status-list', () => ({
  ReservationStatusList: () => <div data-testid="reservation-list-stub" />,
}))
vi.mock('@/components/booking/session-timeline', () => ({
  SessionTimeline: () => <div data-testid="session-timeline-stub" />,
}))
vi.mock('@/components/booking/portal-progress-card', () => ({
  PortalProgressCard: () => <div data-testid="portal-progress-stub" />,
}))
vi.mock('@/components/booking/send-portal-link', () => ({
  SendPortalLink: () => <div data-testid="send-portal-link-stub" />,
}))
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmActionDialog: ({ open, onConfirm, title }: { open: boolean; onConfirm: () => void; title: string }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
}))

// ── Fixtures ────────────────────────────────────────────────────────────────────

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'booking-abc',
    status: 'Draft',
    activityType: ['DSD'],
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    divers: [],
    operatorName: 'Test Center',
    bookingFormComplete: false,
    customerFormComplete: false,
    medicalHardBlock: false,
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    sessions: [],
    stakeholders: [],
    reservations: [],
    customerProfiles: [],
    expiresAt: Date.now() + 43200000,
    ...overrides,
  }
}

const defaultProps = {
  bookingId: 'booking-abc',
  onClose: vi.fn(),
}

// ── Tests ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  qIdx = 0
  mockBooking = undefined
  mockPortalLink = undefined
})

describe('BookingDetailDialog', () => {
  it('renders nothing meaningful when bookingId is null', () => {
    const { container } = render(
      <BookingDetailDialog bookingId={null} onClose={vi.fn()} />,
    )
    // Dialog is closed; no booking content visible
    expect(screen.queryByText('Resume')).toBeNull()
    expect(screen.queryByText('Discard')).toBeNull()
    // container may still render a dialog shell but no booking body
    expect(container).toBeTruthy()
  })

  it('shows skeleton while booking is loading (undefined)', () => {
    mockBooking = undefined // still loading
    mockPortalLink = undefined
    render(<BookingDetailDialog {...defaultProps} />)
    // Skeleton renders Cards with Skeleton placeholders — no action buttons visible
    expect(screen.queryByRole('button', { name: /resume/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /discard/i })).toBeNull()
  })

  it('shows empty state when booking is null (not found)', () => {
    mockBooking = null
    mockPortalLink = null
    render(<BookingDetailDialog {...defaultProps} />)
    expect(screen.getByText(/booking not found/i)).toBeInTheDocument()
  })

  it('renders draft booking with Resume and Discard buttons', () => {
    mockBooking = makeBooking({ status: 'Draft' })
    mockPortalLink = null
    render(<BookingDetailDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
  })

  it('calls discardDraft mutation when Discard confirmed', async () => {
    mockDiscardDraft.mockResolvedValueOnce(undefined)
    mockBooking = makeBooking({ status: 'Draft' })
    mockPortalLink = null
    render(<BookingDetailDialog {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /discard/i }))

    // Confirm dialog appears
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalledWith({ bookingId: 'booking-abc' })
    })
  })
})
