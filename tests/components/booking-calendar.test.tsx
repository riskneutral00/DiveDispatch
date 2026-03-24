// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import type { CalendarDay } from '@/lib/hooks/use-calendar-range'
import { addDays, toISODateString } from '@/lib/utils/date'

// ── Build a controlled 7-day week relative to a dynamic "today" ─────────────
// ANCHOR is 10 days from the real today. The faked clock is set to ANCHOR.
const ANCHOR = addDays(toISODateString(new Date()), 10)
const anchorDate = new Date(ANCHOR + 'T12:00:00')

// 7-day week: ANCHOR is at index 5 ("today"), index 0–4 = past, index 6 = future
const WEEK_START = addDays(ANCHOR, -5)
const FUTURE_DATE = addDays(ANCHOR, 1)

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

const WEEK: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
  const ds = addDays(ANCHOR, i - 5)
  return makeDay(ds, ds === ANCHOR)
})

// ── Mocks ──────────────────────────────────────────────────────────────────────

// useCalendarRange — return exactly our controlled week
vi.mock('@/lib/hooks/use-calendar-range', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-calendar-range')>(
    '@/lib/hooks/use-calendar-range',
  )
  return {
    ...actual,
    useCalendarRange: () => ({
      range: {
        start: new Date(WEEK_START + 'T00:00:00'),
        end: new Date(FUTURE_DATE + 'T00:00:00'),
      },
      shiftRange: vi.fn(),
      jumpToDate: vi.fn(),
      resetRange: vi.fn(),
      weeks: [WEEK],
      headerLabel: `${WEEK_START} – ${FUTURE_DATE}`,
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
    vi.setSystemTime(anchorDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('past date has glass-surface class (hover shimmer)', () => {
    const { getByTestId } = render(<BookingCalendar onDateClick={vi.fn()} />)
    const cell = getByTestId(`cell-${WEEK_START}`)
    expect(cell.className).toContain('glass-surface')
  })

  it('past date ignores clicks', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    fireEvent.click(getByTestId(`cell-${WEEK_START}`))
    expect(spy).not.toHaveBeenCalled()
  })

  it('today highlights and is clickable', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    const cell = getByTestId(`cell-${ANCHOR}`)
    expect(cell.className).toContain('glass-surface')
    fireEvent.click(cell)
    expect(spy).toHaveBeenCalledWith(ANCHOR)
  })

  it('future date highlights and is clickable', () => {
    const spy = vi.fn()
    const { getByTestId } = render(<BookingCalendar onDateClick={spy} />)
    const cell = getByTestId(`cell-${FUTURE_DATE}`)
    expect(cell.className).toContain('glass-surface')
    fireEvent.click(cell)
    expect(spy).toHaveBeenCalledWith(FUTURE_DATE)
  })
})

describe('BookingCalendar — droppable conditional rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(anchorDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders without crash when droppableEnabled=false (no DndContext)', () => {
    // This is the critical test — PlainDateCell must not call useDroppable
    const { getByTestId } = render(
      <BookingCalendar onDateClick={vi.fn()} droppableEnabled={false} />,
    )
    // Calendar renders normally — date cells exist
    expect(getByTestId(`cell-${ANCHOR}`)).toBeTruthy()
    expect(getByTestId(`cell-${FUTURE_DATE}`)).toBeTruthy()
  })

  it('renders without crash when droppableEnabled=true inside DndContext', async () => {
    const { DndContext } = await import('@dnd-kit/core')
    const { getByTestId } = render(
      <DndContext>
        <BookingCalendar onDateClick={vi.fn()} droppableEnabled={true} />
      </DndContext>,
    )
    expect(getByTestId(`cell-${ANCHOR}`)).toBeTruthy()
    expect(getByTestId(`cell-${FUTURE_DATE}`)).toBeTruthy()
  })
})
