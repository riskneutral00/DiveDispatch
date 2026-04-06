// @vitest-environment jsdom
/**
 * Tests for PortalLinkSection inside booking-detail-shared.
 *
 * 1. Shows "Send Link" button when no portal link exists
 * 2. Shows the create form after clicking "Send Link"
 * 3. Shows portal URL when a portal link exists
 * 4. Calls createLink mutation on form submit
 * 5. Shows error when createLink mutation fails
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../helpers/render'
import { BookingDetailBody } from '@/components/booking/booking-detail-shared'
import type { BookingDetailBodyProps } from '@/components/booking/booking-detail-shared'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockCreateLink = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: () => undefined,
    useMutation: () => mockCreateLink,
  }
})

// Stub sub-components that make their own queries or are not under test
vi.mock('@/components/booking/audit-trail-table', () => ({
  AuditTrailTable: () => <div data-testid="audit-trail-stub" />,
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

// ── Fixtures ────────────────────────────────────────────────────────────────────

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'booking-xyz',
    status: 'Upcoming',
    activityType: ['DSD'],
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'us', label: 'United States' },
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        activityType: ['DSD'],
        contactType: 'email' as const,
        contactValue: 'alice@example.com',
      },
    ],
    operatorName: 'Test Center',
    bookingFormComplete: true,
    customerFormComplete: false,
    medicalHardBlock: false,
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    sessions: [],
    stakeholders: [],
    reservations: [],
    customerProfiles: [],
    ...overrides,
  }
}

function makeProps(overrides: Partial<BookingDetailBodyProps> = {}): BookingDetailBodyProps {
  return {
    booking: makeBooking() as BookingDetailBodyProps['booking'],
    bookingId: 'booking-xyz',
    portalLink: undefined,
    layout: 'page',
    compact: false,
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BookingDetailBody — PortalLinkSection', () => {
  it('shows Send Link button when no portal link exists', () => {
    render(<BookingDetailBody {...makeProps({ portalLink: null })} />)
    expect(screen.getByRole('button', { name: /send link/i })).toBeInTheDocument()
  })

  it('shows customer portal form fields after clicking Send Link', () => {
    render(<BookingDetailBody {...makeProps({ portalLink: null })} />)
    fireEvent.click(screen.getByRole('button', { name: /send link/i }))
    expect(screen.getByText(/customer name/i)).toBeInTheDocument()
    expect(screen.getByText(/customer email/i)).toBeInTheDocument()
  })

  it('shows portal URL when a portal link exists', () => {
    const portalLink = {
      _id: 'link1' as import('@/lib/convex-generated').Id<'bookingLinks'>,
      bookingId: 'booking-xyz' as import('@/lib/convex-generated').Id<'bookings'>,
      token: 'tok-abc',
      customerName: 'Alice',
      email: 'alice@example.com',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    }
    render(<BookingDetailBody {...makeProps({ portalLink })} />)
    expect(screen.getByTestId('portal-link-url')).toBeInTheDocument()
  })

  it('calls createLink mutation on form submit', async () => {
    mockCreateLink.mockResolvedValueOnce(undefined)
    render(<BookingDetailBody {...makeProps({ portalLink: null })} />)

    fireEvent.click(screen.getByRole('button', { name: /send link/i }))

    // Name input is pre-filled from diver; change it
    const nameInput = screen.getByDisplayValue('Alice')
    fireEvent.change(nameInput, { target: { value: 'Bob' } })

    // Email input has type="email" — query by its input type attribute
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'bob@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: /generate link/i }))

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith({
        bookingId: 'booking-xyz',
        customerName: 'Bob',
        email: 'bob@example.com',
      })
    })
  })

  it('shows error message when createLink mutation fails', async () => {
    mockCreateLink.mockRejectedValueOnce(new Error('Server error'))
    render(<BookingDetailBody {...makeProps({ portalLink: null })} />)

    fireEvent.click(screen.getByRole('button', { name: /send link/i }))

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'bob@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: /generate link/i }))

    await waitFor(() => {
      expect(screen.getByText(/generate link failed/i)).toBeInTheDocument()
    })
  })
})
