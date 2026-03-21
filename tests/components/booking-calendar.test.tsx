// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import type { CalendarDay } from '@/lib/hooks/use-calendar-range'

// ── Build a controlled 7-day week: 2026-03-15 (Sun) → 2026-03-21 (Sat) ──
function makeDay(dateString: string, isToday: boolean): CalendarDay {
  const [y, m, d] = dateString.split('-').map(Number)
  return {
    date: new Date(y, m - 1, d),
    dayOfMonth: d,
    isCurrentMonth: true,
    isToday,
    dateString,
  }
}

const WEEK: CalendarDay[] = [
  makeDay('2026-03-15', false),
  makeDay('2026-03-16', false),
  makeDay('2026-03-17', false),
  makeDay('2026-03-18', false),
  makeDay('2026-03-19', false),
  makeDay('2026-03-20', true),  // today (Friday)
  makeDay('2026-03-21', false), // future (Saturday)
]

// ── Mocks ──────────────────────────────────────────────────────────────────────

// useCalendarRange — return exactly our controlled week
vi.mock('@/lib/hooks/use-calendar-range', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-calendar-range')>(
    '@/lib/hooks/use-calendar-range',
  )
  return {
    ...actual,
    useCalendarRange: () => ({
      range: { start: new Date(2026, 2, 15), end: new Date(2026, 2, 21) },
      shiftRange: vi.fn(),
      jumpToDate: vi.fn(),
      resetRange: vi.fn(),
      weeks: [WEEK],
      headerLabel: 'Mar 15 – 21, 2026',
      todayCol: 5,
    }),
  }
})

// Stub child components that aren't relevant to this test
vi.mock('@/components/booking/calendar-legend', () => ({
  CalendarLegend: () => null,
}))
vi.mock('@/components/booking/urgent-booking-strip', () => ({
  UrgentBookingStrip: () => null,
}))
vi.mock('@/components/glass', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Convex — no backend needed
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => undefined,
  }
})

// ── Import component AFTER mocks are registered ───────────────────────────────
import { BookingCalendar } from '@/components/booking/booking-calendar'

describe('BookingCalendar — past vs today/future click behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 20, 12, 0, 0)) // 2026-03-20 noon
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('past date has glass-surface class (hover shimmer)', () => {
    const { getByTestId } = render(<BookingCalendar onDateClick={vi.fn()} />)
    const cell = getByTestId('cell-2026-03-15')
    expect(cell.className).toContain('glass-surface')
  })

  it('past date ignores clicks', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    fireEvent.click(getByTestId('cell-2026-03-15'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('today highlights and is clickable', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    const cell = getByTestId('cell-2026-03-20')
    expect(cell.className).toContain('glass-surface')
    fireEvent.click(cell)
    expect(spy).toHaveBeenCalledWith('2026-03-20')
  })

  it('future date highlights and is clickable', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    const cell = getByTestId('cell-2026-03-21')
    expect(cell.className).toContain('glass-surface')
    fireEvent.click(cell)
    expect(spy).toHaveBeenCalledWith('2026-03-21')
  })
})
