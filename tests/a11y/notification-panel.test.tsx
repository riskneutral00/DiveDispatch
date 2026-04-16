// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '../helpers/render'

const mockNotifications = vi.fn()

vi.mock('@/lib/hooks/use-optimistic-notifications', () => ({
  useOptimisticNotifications: () => ({
    notifications: mockNotifications(),
    unreadCount: 0,
    handleMarkAsRead: vi.fn().mockResolvedValue(undefined),
    handleDelete: vi.fn().mockResolvedValue(undefined),
    handleClearAll: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <span data-testid="spinner">Loading…</span>,
}))

vi.mock('lucide-react', () => {
  const stub = ({ size, ...props }: Record<string, unknown>) => (
    <svg data-testid="icon" {...props} />
  )
  return {
    AlertTriangle: stub,
    ArrowRightLeft: stub,
    Ban: stub,
    Bell: stub,
    CheckCircle: stub,
    Clock: stub,
    FileText: stub,
    RotateCcw: stub,
    ShieldCheck: stub,
    Trash2: stub,
    UserCheck: stub,
    UserX: stub,
    UsersRound: stub,
    XCircle: stub,
  }
})

vi.mock('@/lib/notifications/notification-config', () => ({
  getNotificationStyle: () => ({ icon: 'Bell', color: '#000' }),
}))

import { NotificationPanel } from '@/components/notifications/notification-panel'

const SAMPLE_NOTIFICATIONS = [
  { _id: 'n1', type: 'hold_placed', message: 'New booking request', createdAt: Date.now() - 60000 },
  { _id: 'n2', type: 'booking_confirmed', message: 'Booking confirmed', createdAt: Date.now() - 120000, readAt: Date.now() },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications.mockReturnValue(SAMPLE_NOTIFICATIONS)
})

describe('NotificationPanel structure', () => {
  it('renders with group role and accessible label', () => {
    render(<NotificationPanel userId="test-user" />)
    const panel = screen.getByRole('group', { name: 'Notifications' })
    expect(panel).toBeInTheDocument()
  })

  it('renders notification items', () => {
    render(<NotificationPanel userId="test-user" />)
    expect(screen.getByText('New booking request')).toBeInTheDocument()
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument()
  })
})

describe('NotificationPanel aria-live announcements', () => {
  it('announces when a notification is marked as read', async () => {
    render(<NotificationPanel userId="test-user" />)

    const notificationButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('New booking request'),
    )
    expect(notificationButtons.length).toBeGreaterThan(0)

    const user = userEvent.setup()
    await user.click(notificationButtons[0])

    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion.textContent).toMatch(/marking notification as read/i)
    })
  })

  it('announces when all notifications are cleared', async () => {
    render(<NotificationPanel userId="test-user" />)

    const clearButton = screen.getByText('Clear')
    const user = userEvent.setup()
    await user.click(clearButton)

    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion.textContent).toMatch(/cleared/i)
    })
  })

  it('announces when a notification is deleted', async () => {
    render(<NotificationPanel userId="test-user" />)

    const deleteButtons = screen.getAllByLabelText('Delete notification')
    expect(deleteButtons.length).toBeGreaterThan(0)

    const user = userEvent.setup()
    await user.click(deleteButtons[0])

    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion.textContent).toMatch(/deleted/i)
    })
  })
})

describe('NotificationItem unread dot', () => {
  it('unread indicator has aria-hidden="true" instead of aria-label', () => {
    render(<NotificationPanel userId="test-user" />)

    const unreadDots = document.querySelectorAll('[aria-hidden="true"]')
    const dot = Array.from(unreadDots).find(
      (el) => el.classList.contains('rounded-full') && el.classList.contains('w-2'),
    )
    expect(dot).toBeInTheDocument()
    expect(dot).not.toHaveAttribute('aria-label')
  })
})
