// @vitest-environment jsdom
/**
 * NotificationPanel — WCAG accessibility tests (DD-279)
 *
 * Covers:
 * - Focus moves into panel on open (SC 4.1.2)
 * - aria-modal="true" on dialog root
 * - Tab/Shift-Tab focus trap within panel boundary
 * - Focus restores to trigger on close
 * - aria-live="polite" region announces operations
 * - Unread dot uses aria-hidden (not spurious aria-label)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '../helpers/render'

// ── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('@/components/common/spinner', () => ({
  Spinner: () => <span data-testid="spinner">Loading...</span>,
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

// ── Import after mocks ──────────────────────────────────────────────────────

import { NotificationPanel } from '@/components/dashboard/notification-panel'

const SAMPLE_NOTIFICATIONS = [
  { _id: 'n1', type: 'hold_placed', message: 'New booking request', createdAt: Date.now() - 60000 },
  { _id: 'n2', type: 'booking_confirmed', message: 'Booking confirmed', createdAt: Date.now() - 120000, readAt: Date.now() },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications.mockReturnValue(SAMPLE_NOTIFICATIONS)
})

// ── Focus management ────────────────────────────────────────────────────────

describe('NotificationPanel focus management', () => {
  it('moves focus to first focusable element on open', () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    // The first focusable element inside the panel should have focus
    const firstFocusable = dialog.querySelector('button')
    expect(firstFocusable).toBeInTheDocument()
    expect(document.activeElement).toBe(firstFocusable)
  })

  it('sets aria-modal="true" on the dialog root', () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when Escape is pressed while panel has focus', async () => {
    const onClose = vi.fn()
    render(<NotificationPanel userId="test-user" onClose={onClose} />)

    // Panel auto-focuses, so Escape should fire onClose
    const user = userEvent.setup()
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to trigger ref when panel unmounts', () => {
    const triggerRef = document.createElement('button')
    triggerRef.textContent = 'Trigger'
    document.body.appendChild(triggerRef)
    triggerRef.focus()

    const { unmount } = render(
      <NotificationPanel
        userId="test-user"
        onClose={vi.fn()}
        triggerRef={{ current: triggerRef }}
      />,
    )

    // Focus is inside the panel after mount
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Unmount simulates parent setting open=false after onClose
    unmount()

    // Focus should be restored to the trigger element
    expect(document.activeElement).toBe(triggerRef)

    document.body.removeChild(triggerRef)
  })
})

// ── Focus trap ──────────────────────────────────────────────────────────────

describe('NotificationPanel focus trap', () => {
  it('traps Tab from last focusable element to first', async () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    expect(focusableElements.length).toBeGreaterThan(1)

    const lastFocusable = focusableElements[focusableElements.length - 1]
    lastFocusable.focus()
    expect(document.activeElement).toBe(lastFocusable)

    const user = userEvent.setup()
    await user.tab()

    // Should wrap to first focusable
    expect(document.activeElement).toBe(focusableElements[0])
  })

  it('traps Shift+Tab from first focusable element to last', async () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    const firstFocusable = focusableElements[0]
    firstFocusable.focus()
    expect(document.activeElement).toBe(firstFocusable)

    const user = userEvent.setup()
    await user.tab({ shift: true })

    // Should wrap to last focusable
    const lastFocusable = focusableElements[focusableElements.length - 1]
    expect(document.activeElement).toBe(lastFocusable)
  })
})

// ── aria-live announcements ─────────────────────────────────────────────────

describe('NotificationPanel aria-live announcements', () => {
  it('announces when a notification is marked as read', async () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    // Click the first notification item (mark as read)
    const notificationButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('New booking request'),
    )
    expect(notificationButtons.length).toBeGreaterThan(0)

    const user = userEvent.setup()
    await user.click(notificationButtons[0])

    // The aria-live region should contain an announcement after async handler settles
    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion.textContent).toMatch(/marked as read/i)
    })
  })

  it('announces when all notifications are cleared', async () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    const clearButton = screen.getByText('Clear all')
    const user = userEvent.setup()
    await user.click(clearButton)

    await waitFor(() => {
      const liveRegion = screen.getByRole('status')
      expect(liveRegion.textContent).toMatch(/cleared/i)
    })
  })

  it('announces when a notification is deleted', async () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

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

// ── Unread dot a11y ─────────────────────────────────────────────────────────

describe('NotificationItem unread dot', () => {
  it('unread indicator has aria-hidden="true" instead of aria-label', () => {
    render(<NotificationPanel userId="test-user" onClose={vi.fn()} />)

    // The unread dot should be aria-hidden, not have an aria-label
    const unreadDots = document.querySelectorAll('[aria-hidden="true"]')
    // Find the unread dot specifically (it's a small circle div)
    const dot = Array.from(unreadDots).find(
      (el) => el.classList.contains('rounded-full') && el.classList.contains('w-2'),
    )
    expect(dot).toBeInTheDocument()
    expect(dot).not.toHaveAttribute('aria-label')
  })
})
