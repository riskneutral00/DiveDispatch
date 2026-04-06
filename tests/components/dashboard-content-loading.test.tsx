// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStableQuery = vi.fn()
vi.mock('@/lib/hooks/use-stable-query', () => ({
  useStableQuery: (...args: unknown[]) => mockStableQuery(...args),
}))

vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ user: { slug: 'hug-ocean', _id: 'user1' }, isLoading: false }),
}))

vi.mock('@/lib/hooks/use-operator-defaults', () => ({
  useOperatorDefaults: () => ({ defaults: null }),
}))

vi.mock('@/components/dev/dev-switch-context', () => ({
  useDevSwitching: () => ({ isSwitching: false }),
}))

vi.mock('@/lib/hooks/use-blocked-date-toggle', () => ({
  useBlockedDateToggle: () => ({
    blockedDates: [], pendingToggle: vi.fn(), requestToggle: vi.fn(),
    confirmToggle: vi.fn(), cancelToggle: vi.fn(), isToggling: false,
  }),
}))

vi.mock('@/lib/hooks/use-booking-actions', () => ({
  useBookingActions: () => ({
    handleBookingClick: vi.fn(), handleUrgentCancel: vi.fn(),
    quickDetail: null, setQuickDetail: vi.fn(),
    cancelTarget: null, setCancelTarget: vi.fn(),
  }),
}))

vi.mock('@/lib/hooks/use-booking-dnd', () => ({
  useBookingDnd: () => ({
    pendingPreFill: null, clearPendingPreFill: vi.fn(),
    handleDragEnd: vi.fn(), activeId: null,
  }),
  BOOKING_DND_SENSORS: [],
}))

// Stub heavy child components
vi.mock('@/components/booking/booking-calendar', () => ({
  BookingCalendar: () => <div data-testid="booking-calendar">Calendar</div>,
}))
vi.mock('@/components/booking/quick-book-rail', () => ({
  QuickBookRail: () => null,
}))
vi.mock('@/components/booking/booking-overlay', () => ({
  BookingOverlay: () => null,
}))
vi.mock('@/components/booking/booking-quick-detail', () => ({
  BookingQuickDetail: () => null,
}))
vi.mock('@/components/booking/cancel-booking-dialog', () => ({
  CancelBookingDialog: () => null,
}))
vi.mock('@/components/booking/block-date-dialog', () => ({
  BlockDateDialog: () => null,
}))
vi.mock('@/components/booking/drag-overlay-pill', () => ({
  DragOverlayPill: () => null,
}))
vi.mock('@/components/booking/diver-equipment-widget', () => ({
  DiverEquipmentWidget: () => null,
}))
vi.mock('@/components/booking/vessel-calendar', () => ({
  VesselCalendar: () => null,
}))
vi.mock('@/components/booking/boat-manifest-widget', () => ({
  BoatManifestWidget: () => null,
}))
vi.mock('@/components/booking/pending-requests-list', () => ({
  PendingRequestsList: () => null,
}))
vi.mock('@/components/booking/urgent-booking-strip', () => ({
  UrgentBookingStrip: () => null,
}))
vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
}))

import { DashboardContent } from '@/components/layout/dashboard-content'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardContent loading state', () => {
  it('shows loading indicator when bookings query is still loading (data=undefined)', () => {
    mockStableQuery.mockImplementation((_fn: unknown, args: unknown) => {
      if (args === 'skip') return { data: undefined }
      return { data: undefined } // loading
    })

    const { queryByTestId, getByText } = render(
      <DashboardContent roleSlug="dive-center" slug="hug-ocean" />,
    )
    expect(getByText(/loading/i)).toBeInTheDocument()
    expect(queryByTestId('booking-calendar')).not.toBeInTheDocument()
  })

  it('shows calendar when bookings query resolves to empty array', () => {
    mockStableQuery.mockImplementation((_fn: unknown, args: unknown) => {
      if (args === 'skip') return { data: undefined }
      return { data: [] }
    })

    const { getByTestId, queryByText } = render(
      <DashboardContent roleSlug="dive-center" slug="hug-ocean" />,
    )
    expect(getByTestId('booking-calendar')).toBeInTheDocument()
    // No loading indicator when data is resolved
    expect(queryByText(/loading/i)).not.toBeInTheDocument()
  })
})
