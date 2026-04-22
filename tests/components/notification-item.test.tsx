// @vitest-environment jsdom
/**
 * DD-360: NotificationItem logistics rendering tests.
 *
 * Tests:
 * 1. Renders logistics fields when present (DiveCenter operator data)
 * 2. Renders without logistics section when logistics is absent
 * 3. Renders partial logistics (only departureTime)
 * 4. Logistics section renders identically for DiveCenter and Agent operator data
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { NotificationItem } from '../../src/components/notifications/notification-item'
import type { NotificationDoc } from '../../src/lib/types/notifications'

function baseNotification(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: 'notif-1',
    type: 'booking_confirmed',
    message: 'Your booking is confirmed.',
    createdAt: Date.now(),
    ...overrides,
  }
}

const noop = () => {}

describe('NotificationItem — logistics rendering', () => {
  it('renders message when no logistics present', () => {
    render(
      <NotificationItem
        notification={baseNotification()}
        onClick={noop}
        onDelete={noop}
      />,
    )

    expect(screen.getByText('Your booking is confirmed.')).toBeInTheDocument()
    expect(screen.queryByTestId('logistics-section')).not.toBeInTheDocument()
  })

  it('renders logistics section when logistics object is present (DiveCenter data)', () => {
    const notification = baseNotification({
      logistics: {
        pickupTime: '07:30',
        pickupLocation: 'Hotel lobby',
        departureTime: '08:00',
        departureLocation: 'Main pier',
        boatName: 'MV Sea Rider',
        meetingPoint: 'Pier 1, Gate A',
      },
    })

    render(
      <NotificationItem notification={notification} onClick={noop} onDelete={noop} />,
    )

    expect(screen.getByTestId('logistics-section')).toBeInTheDocument()
    expect(screen.getByText('07:30')).toBeInTheDocument()
    expect(screen.getByText('Hotel lobby')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('Main pier')).toBeInTheDocument()
    expect(screen.getByText('MV Sea Rider')).toBeInTheDocument()
    expect(screen.getByText('Pier 1, Gate A')).toBeInTheDocument()
  })

  it('renders only the fields that are present (partial logistics)', () => {
    const notification = baseNotification({
      logistics: {
        departureTime: '08:00',
      },
    })

    render(
      <NotificationItem notification={notification} onClick={noop} onDelete={noop} />,
    )

    expect(screen.getByTestId('logistics-section')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    // Fields not provided should not appear
    expect(screen.queryByText('Hotel lobby')).not.toBeInTheDocument()
    expect(screen.queryByText('MV Sea Rider')).not.toBeInTheDocument()
  })

  it('renders logistics identically for Agent-owned booking data', () => {
    const notification = baseNotification({
      type: 'booking_confirmed',
      message: 'Booking confirmed (Agent referral).',
      logistics: {
        departureTime: '09:00',
        departureLocation: 'East pier',
        boatName: 'MV Agent Special',
      },
    })

    render(
      <NotificationItem notification={notification} onClick={noop} onDelete={noop} />,
    )

    expect(screen.getByTestId('logistics-section')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('East pier')).toBeInTheDocument()
    expect(screen.getByText('MV Agent Special')).toBeInTheDocument()
  })

  it('renders logistics identically for Agent-owned booking with departure data', () => {
    const notification = baseNotification({
      type: 'booking_confirmed',
      message: 'Trip confirmed.',
      logistics: {
        departureTime: '10:00',
        departureLocation: 'Chumphon pier',
        boatName: 'MV Pacific Star',
        meetingPoint: 'Check-in counter',
      },
    })

    render(
      <NotificationItem notification={notification} onClick={noop} onDelete={noop} />,
    )

    expect(screen.getByTestId('logistics-section')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('Chumphon pier')).toBeInTheDocument()
    expect(screen.getByText('MV Pacific Star')).toBeInTheDocument()
    expect(screen.getByText('Check-in counter')).toBeInTheDocument()
  })

  it('existing non-logistics notification types still render without logistics section', () => {
    const notification = baseNotification({
      type: 'hold_placed',
      message: 'A hold has been placed on your calendar.',
    })

    render(
      <NotificationItem notification={notification} onClick={noop} onDelete={noop} />,
    )

    expect(screen.getByText('A hold has been placed on your calendar.')).toBeInTheDocument()
    expect(screen.queryByTestId('logistics-section')).not.toBeInTheDocument()
  })
})
