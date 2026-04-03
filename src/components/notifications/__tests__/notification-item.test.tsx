// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationItem } from '../notification-item'
import type { NotificationDoc } from '@/lib/types/notifications'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />,
  ArrowRightLeft: (props: Record<string, unknown>) => <svg {...props} />,
  Ban: (props: Record<string, unknown>) => <svg {...props} />,
  Bell: (props: Record<string, unknown>) => <svg data-testid="bell-icon" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <svg {...props} />,
  Clock: (props: Record<string, unknown>) => <svg {...props} />,
  FileText: (props: Record<string, unknown>) => <svg {...props} />,
  RotateCcw: (props: Record<string, unknown>) => <svg {...props} />,
  ShieldCheck: (props: Record<string, unknown>) => <svg {...props} />,
  Trash2: (props: Record<string, unknown>) => <svg data-testid="trash-icon" {...props} />,
  UserCheck: (props: Record<string, unknown>) => <svg {...props} />,
  UserX: (props: Record<string, unknown>) => <svg {...props} />,
  UsersRound: (props: Record<string, unknown>) => <svg {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg {...props} />,
}))

vi.mock('@/lib/utils/time-ago', () => ({
  timeAgo: () => '5m ago',
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const unreadNotification: NotificationDoc = {
  _id: 'n-1',
  type: 'booking_accepted',
  message: 'Booking #42 accepted',
  createdAt: Date.now() - 300_000,
}

const readNotification: NotificationDoc = {
  ...unreadNotification,
  _id: 'n-2',
  readAt: Date.now(),
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationItem', () => {
  it('delete button meets 44px minimum touch target', () => {
    render(
      <NotificationItem
        notification={unreadNotification}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete notification' })
    expect(deleteButton.className).toContain('min-h-[44px]')
    expect(deleteButton.className).toContain('min-w-[44px]')
  })

  it('delete button centers its icon content', () => {
    render(
      <NotificationItem
        notification={unreadNotification}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete notification' })
    expect(deleteButton.className).toContain('flex')
    expect(deleteButton.className).toContain('items-center')
    expect(deleteButton.className).toContain('justify-center')
  })

  it('delete button calls onDelete with notification id', () => {
    const onDelete = vi.fn()
    render(
      <NotificationItem
        notification={unreadNotification}
        onClick={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }))
    expect(onDelete).toHaveBeenCalledWith('n-1')
  })

  it('clicking notification body calls onClick with notification id', () => {
    const onClick = vi.fn()
    render(
      <NotificationItem
        notification={readNotification}
        onClick={onClick}
        onDelete={vi.fn()}
      />,
    )

    // Click the main content button (not the delete button)
    fireEvent.click(screen.getByText('Booking #42 accepted'))
    expect(onClick).toHaveBeenCalledWith('n-2')
  })

  it('shows unread dot only for unread notifications', () => {
    const { rerender } = render(
      <NotificationItem
        notification={unreadNotification}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    // Unread: dot is present (aria-hidden div with rounded-full)
    const container = screen.getByText('Booking #42 accepted').closest('button')!
    const dot = container.querySelector('[aria-hidden="true"]')
    expect(dot).toBeInTheDocument()

    // Read: no dot
    rerender(
      <NotificationItem
        notification={readNotification}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const containerAfter = screen.getByText('Booking #42 accepted').closest('button')!
    const dotAfter = containerAfter.querySelector('[aria-hidden="true"]')
    expect(dotAfter).not.toBeInTheDocument()
  })
})
