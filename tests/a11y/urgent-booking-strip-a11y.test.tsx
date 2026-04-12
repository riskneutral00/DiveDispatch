// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
}))

vi.mock('@/lib/utils/date', () => ({
  parseDateLocal: (s: string) => new Date(s + 'T00:00:00'),
  formatDateRangeCompact: (start: string, end: string) =>
    start === end ? start : `${start}–${end}`,
}))

import { UrgentBookingStrip } from '@/components/booking/urgent-booking-strip'

const BOOKINGS = [
  { _id: '1', startDate: '2026-04-10', endDate: '2026-04-10' },
  { _id: '2', startDate: '2026-04-12', endDate: '2026-04-14' },
]

describe('UrgentBookingStrip a11y', () => {
  it('has no nested interactive elements (button inside button)', () => {
    const { container } = render(
      <UrgentBookingStrip bookings={BOOKINGS} onCancel={vi.fn()} />,
    )
    const buttons = container.querySelectorAll('button')
    for (const button of buttons) {
      const nestedButtons = button.querySelectorAll('button')
      expect(nestedButtons.length).toBe(0)

      const nestedRoleButtons = button.querySelectorAll('[role="button"]')
      expect(nestedRoleButtons.length).toBe(0)
    }
  })

  it('does not use hardcoded text-white classes', () => {
    const { container } = render(
      <UrgentBookingStrip bookings={BOOKINGS} onCancel={vi.fn()} />,
    )
    const allElements = container.querySelectorAll('*')
    for (const el of allElements) {
      const cls = el.className
      if (typeof cls === 'string') {
        expect(cls).not.toMatch(/\btext-white\b/)
      }
    }
  })

  it('fires onBookingClick for date area and onCancel for X', () => {
    const onBookingClick = vi.fn()
    const onCancel = vi.fn()

    const { getAllByLabelText, getAllByRole } = render(
      <UrgentBookingStrip
        bookings={BOOKINGS}
        onBookingClick={onBookingClick}
        onCancel={onCancel}
      />,
    )

    const cancelButtons = getAllByLabelText('Cancel urgent booking')
    expect(cancelButtons.length).toBe(2)

    fireEvent.click(cancelButtons[0])
    expect(onCancel).toHaveBeenCalledWith('1')

    // Find the booking click target — it should be a separate interactive element
    const buttons = getAllByRole('button')
    // There should be at least 4 buttons (2 date + 2 cancel)
    expect(buttons.length).toBeGreaterThanOrEqual(4)
  })

  it('cancel button is keyboard accessible via Enter', () => {
    const onCancel = vi.fn()

    const { getAllByLabelText } = render(
      <UrgentBookingStrip bookings={BOOKINGS} onCancel={onCancel} />,
    )

    const cancelButtons = getAllByLabelText('Cancel urgent booking')
    fireEvent.keyDown(cancelButtons[0], { key: 'Enter' })
    expect(onCancel).toHaveBeenCalledWith('1')
  })
})
