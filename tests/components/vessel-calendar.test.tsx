// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'
import { addDays, toISODateString } from '@/lib/utils/date'
import type { CalendarDay } from '@/lib/utils/calendar-range'
import type { VesselCalendarData } from '../../convex/boatWidget'

const ANCHOR = addDays(toISODateString(new Date()), 10)

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
  const ds = addDays(ANCHOR, i - 3)
  return makeDay(ds, ds === ANCHOR)
})

vi.mock('@/lib/hooks/use-calendar-range', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-calendar-range')>(
    '@/lib/hooks/use-calendar-range',
  )
  return {
    ...actual,
    useCalendarRange: () => ({
      range: { start: WEEK[0].date, end: WEEK[6].date },
      shiftRange: vi.fn(),
      jumpToDate: vi.fn(),
      resetRange: vi.fn(),
      weeks: [WEEK],
      headerLabel: 'Mar 28 – Apr 3',
      todayCol: 3,
    }),
  }
})

import { VesselCalendar } from '@/components/booking/vessel-calendar'

const day0 = WEEK[0].dateString
const day1 = WEEK[1].dateString

const sampleData: VesselCalendarData = {
  vessels: [
    {
      name: 'MV Hug Ocean',
      boatType: 'day_boat',
      unitId: 'unit-1',
      maxPax: 50,
      dailyCapacity: {
        [day0]: { booked: 38, total: 50 },
        [day1]: { booked: 50, total: 50 },
      },
    },
    {
      name: 'MV Reef',
      boatType: 'speedboat',
      unitId: 'unit-2',
      maxPax: 20,
      dailyCapacity: {
        [day0]: { booked: 0, total: 20 },
      },
    },
  ],
}

describe('VesselCalendar', () => {
  it('renders vessel names', () => {
    render(<VesselCalendar data={sampleData} />)
    expect(screen.getByText('MV Hug Ocean')).toBeTruthy()
    expect(screen.getByText('MV Reef')).toBeTruthy()
  })

  it('renders capacity pills with booked/total', () => {
    render(<VesselCalendar data={sampleData} />)
    expect(screen.getByText('38/50')).toBeTruthy()
    expect(screen.getAllByText('0/20').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the header label', () => {
    render(<VesselCalendar data={sampleData} />)
    expect(screen.getByText('Mar 28 – Apr 3')).toBeTruthy()
  })

  it('renders accessible aria-labels on capacity cells', () => {
    render(<VesselCalendar data={sampleData} />)
    const cell = screen.getByLabelText(`MV Hug Ocean, ${day0}, 38 of 50 seats booked`)
    expect(cell).toBeTruthy()
  })

  it('renders empty fleet message when no vessels', () => {
    render(<VesselCalendar data={{ vessels: [] }} />)
    expect(screen.getByText(/No vessels found/)).toBeTruthy()
  })

  it('calls onRangeChange when rendered', async () => {
    const onRangeChange = vi.fn()
    render(<VesselCalendar data={sampleData} onRangeChange={onRangeChange} />)
    await vi.waitFor(() => {
      expect(onRangeChange).toHaveBeenCalled()
    })
  })

  it('handles null data gracefully (loading state)', () => {
    render(<VesselCalendar data={null} />)
    expect(screen.getByText(/No vessels found/)).toBeTruthy()
  })
})
