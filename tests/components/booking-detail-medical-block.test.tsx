// @vitest-environment jsdom
/**
 * Tests for the "Clear medical block" button on the booking detail page.
 *
 * Tests:
 * 1. Button visible when medicalHardBlock: true + operator role (DiveCenter)
 * 2. Button NOT visible when medicalHardBlock: false
 * 3. Button NOT visible when medicalHardBlock: true + non-operator role (Instructor)
 * 4. Click button calls clearMedicalBlock mutation with correct bookingId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'
import { screen, fireEvent } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

// The component calls useQuery 3 times and useMutation 2 times per render.
// The counter resets at the START of each component render (via useRef trick below).
// Order: useQuery(getBookingDetail), useQuery(getByBookingId), useQuery(myRoles)
//        useMutation(cancelBooking), useMutation(clearMedicalBlock)

let mockBooking: unknown = undefined
let mockPortalLink: unknown = undefined
let mockUserRoles: unknown = undefined
const mockCancelBooking = vi.fn()
const mockClearMedicalBlock = vi.fn()

// Reset counters on every useQuery/useMutation cycle (handles re-renders).
// We track per-render-cycle by resetting when we see query index 0 again.
let qIdx = 0
let mIdx = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: () => {
      // Reset on new render cycle: the first hook call in the component is getBookingDetail
      // which is always qIdx 0. If qIdx is already past 0, we've started a new render.
      if (qIdx >= 3) qIdx = 0
      const idx = qIdx++
      if (idx === 0) return mockBooking
      if (idx === 1) return mockPortalLink
      return mockUserRoles
    },
    useMutation: () => {
      if (mIdx >= 2) mIdx = 0
      const idx = mIdx++
      if (idx === 0) return mockCancelBooking
      return mockClearMedicalBlock
    },
  }
})

// Stub child components that make their own useQuery/useMutation calls
vi.mock('@/components/booking/audit-trail-table', () => ({
  AuditTrailTable: () => <div data-testid="audit-trail-stub" />,
}))

vi.mock('@/components/booking/booking-detail-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/booking/booking-detail-shared')>()
  return {
    ...actual,
    PortalLinkSection: () => <div data-testid="portal-link-stub" />,
  }
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import { BookingDetail } from '@/components/booking/booking-detail'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'booking123',
    status: 'Draft',
    activityType: ['DSD'],
    startDate: '2026-04-01',
    endDate: '2026-04-01',
    divers: [{
      name: 'Test Diver',
      abbrev: 'TD',
      flag: { code: 'us', label: 'United States' },
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      activityType: ['DSD'],
    }],
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
    expiresAt: Date.now() + 43200000,
    ...overrides,
  }
}

function makeOperatorRoles() {
  return [{ _id: 'role1', userId: 'u1', role: 'DiveCenter' }]
}

function makeResourceRoles() {
  return [{ _id: 'role2', userId: 'u1', role: 'Instructor' }]
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  qIdx = 0
  mIdx = 0
  mockBooking = undefined
  mockPortalLink = undefined
  mockUserRoles = undefined
})

describe('BookingDetail — Clear medical block button', () => {
  it('shows button when medicalHardBlock is true and user is operator', () => {
    mockBooking = makeBooking({ medicalHardBlock: true })
    mockPortalLink = null
    mockUserRoles = makeOperatorRoles()

    render(<BookingDetail bookingId="booking123" />)

    expect(screen.getByRole('button', { name: /clear medical block/i })).toBeTruthy()
  })

  it('hides button when medicalHardBlock is false', () => {
    mockBooking = makeBooking({ medicalHardBlock: false })
    mockPortalLink = null
    mockUserRoles = makeOperatorRoles()

    render(<BookingDetail bookingId="booking123" />)

    expect(screen.queryByRole('button', { name: /clear medical block/i })).toBeNull()
  })

  it('hides button when user is not an operator (Instructor)', () => {
    mockBooking = makeBooking({ medicalHardBlock: true })
    mockPortalLink = null
    mockUserRoles = makeResourceRoles()

    render(<BookingDetail bookingId="booking123" />)

    expect(screen.queryByRole('button', { name: /clear medical block/i })).toBeNull()
  })

  it('calls clearMedicalBlock mutation with correct bookingId on click', () => {
    mockBooking = makeBooking({ medicalHardBlock: true })
    mockPortalLink = null
    mockUserRoles = makeOperatorRoles()

    render(<BookingDetail bookingId="booking123" />)

    fireEvent.click(screen.getByRole('button', { name: /clear medical block/i }))

    expect(mockClearMedicalBlock).toHaveBeenCalledWith({ bookingId: 'booking123' })
  })
})
