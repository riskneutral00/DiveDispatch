// @vitest-environment jsdom
/**
 * Calendar Pill Touch Targets (DD-162)
 *
 * WCAG 2.5.8 requires interactive elements to have a minimum 44x44px touch target.
 * BookingBar pills use BAR_ROW_HEIGHT - 2 = 26px visual height, which fails on mobile.
 * This test verifies that all interactive booking pills enforce >= 44px touch targets
 * via CSS (minHeight on the element or a pseudo-element/wrapper approach).
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '../helpers/render'
import { BAR_ROW_HEIGHT } from '@/lib/constants/calendar-config'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
    useAction: () => vi.fn(),
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  }
})

// ── Import after mocks ──────────────────────────────────────────────────────

import { BookingBar } from '@/components/booking/booking-bar'

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_TOUCH_TARGET = 44

// ── Helpers ─────────────────────────────────────────────────────────────────

function hasTouchTarget(el: HTMLElement): boolean {
  const style = el.style
  const className = el.className ?? ''

  const heightVal = parseInt(style.minHeight || style.height || '0')
  const classHasMinH =
    /\bmin-h-\[4[4-9]px\]/.test(className) ||
    /\bmin-h-\[[5-9]\dpx\]/.test(className)

  return heightVal >= MIN_TOUCH_TARGET || classHasMinH
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Calendar pill touch targets (WCAG 2.5.8 / DD-162)', () => {
  it('BAR_ROW_HEIGHT constant is exported for layout calculations', () => {
    expect(BAR_ROW_HEIGHT).toBeGreaterThan(0)
  })

  it('BookingBar button has >= 44px minimum touch target height', () => {
    const { getByRole } = render(
      <BookingBar
        id="test-booking"
        label="Test Booking"
        status="Upcoming"
        startCol={0}
        endCol={0}
        row={0}
      />,
    )
    const button = getByRole('button')
    expect(hasTouchTarget(button)).toBe(true)
  })

  it('BookingBar visual height remains compact (uses BAR_ROW_HEIGHT)', () => {
    // The visual rendered height should still use BAR_ROW_HEIGHT - 2 for layout,
    // but the clickable area must be >= 44px
    const { getByRole } = render(
      <BookingBar
        id="test-booking"
        label="Test Booking"
        status="Draft"
        startCol={0}
        endCol={2}
        row={1}
      />,
    )
    const button = getByRole('button')
    // Visual height should still be BAR_ROW_HEIGHT - 2
    expect(button.style.height).toBe(`${BAR_ROW_HEIGHT - 2}px`)
    // But minHeight should enforce 44px touch target
    expect(parseInt(button.style.minHeight || '0')).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })
})
