'use client'

import { useState, useMemo } from 'react'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'
import { isUrgentDraft } from '@/lib/utils/booking-urgency'

// ─── Calendar utility types ────────────────────────────────────────────────────

export interface CalendarDay {
  date: Date
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
  dateString: string
}

export type CalendarWeek = CalendarDay[]

// ─── Calendar utilities ────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 4 * 7

export function toISODateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isTodayDate(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function getFloorDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setFullYear(d.getFullYear() - 1)
  return d
}

export function clampRange(
  start: Date,
  end: Date,
  anchor: 'start' | 'end' = 'start',
): { start: Date; end: Date } {
  const floor = getFloorDate()
  if (anchor === 'start') {
    const s = start < floor ? floor : start
    const clamped = new Date(s)
    clamped.setDate(clamped.getDate() + MAX_RANGE_DAYS - 1)
    return { start: s, end: clamped }
  }
  let clamped = new Date(end)
  clamped.setDate(clamped.getDate() - MAX_RANGE_DAYS + 1)
  if (clamped < floor) clamped = floor
  return { start: clamped, end }
}

export function getDefaultRange(): { start: Date; end: Date } {
  const now = new Date()
  // Current week's Sunday
  const sunday = new Date(now)
  sunday.setDate(sunday.getDate() - sunday.getDay())

  // 1 week lookback, 2 weeks lookahead = 4 weeks total
  const start = new Date(sunday)
  start.setDate(start.getDate() - 7)
  const end = new Date(sunday)
  end.setDate(end.getDate() + 20)
  return { start, end }
}

export function getRangeForDate(date: Date): { start: Date; end: Date } {
  const floor = getFloorDate()
  const sunday = new Date(date)
  sunday.setDate(sunday.getDate() - sunday.getDay())

  let start = new Date(sunday)
  start.setDate(start.getDate() - 7)
  if (start < floor) start = floor

  const end = new Date(sunday)
  end.setDate(end.getDate() + 20)
  return { start, end }
}

export function getRollingGrid(start: Date, end: Date): CalendarWeek[] {
  const gridStart = new Date(start)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const gridEnd = new Date(end)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()))

  const midMs = (start.getTime() + end.getTime()) / 2
  const primaryMonth = new Date(midMs).getMonth()

  const weeks: CalendarWeek[] = []
  const current = new Date(gridStart)

  while (current <= gridEnd) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(current),
        dayOfMonth: current.getDate(),
        isCurrentMonth: current.getMonth() === primaryMonth,
        isToday: isTodayDate(current),
        dateString: toISODateString(current),
      })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

export function formatRangeLabel(start: Date, end: Date): string {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  const sameYear = start.getFullYear() === end.getFullYear()

  const fmtOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }

  const startFmt = new Intl.DateTimeFormat(locale, fmtOpts).format(start)
  const endFmt = new Intl.DateTimeFormat(locale, fmtOpts).format(end)
  return `${startFmt} – ${endFmt}`
}

/** Parse "YYYY-MM-DD" as local midnight (avoids UTC-shift from `new Date(str)`). */
export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getDaysOfWeek(): string[] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
}

/**
 * Derive display status from booking dates and DB status.
 * Cancelled → null (hidden). Draft + past end → null.
 * Upcoming + started → Active. Upcoming/Completed + past end → Completed.
 */
export function deriveStatus(
  booking: { startDate: string; endDate: string; status: string },
  todayStr: string,
): CalendarDisplayStatus | null {
  switch (booking.status) {
    case 'Cancelled':
      return null
    case 'Draft':
      if (booking.endDate && booking.endDate < todayStr) return null
      if (isUrgentDraft(booking)) return 'Urgent'
      return 'Draft'
    case 'Upcoming':
    case 'Completed':
      if (booking.endDate < todayStr) return 'Completed'
      if (booking.status === 'Upcoming' && booking.startDate <= todayStr) return 'Active'
      return 'Upcoming'
    default:
      return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** 4-week rolling window, shifted 2 weeks at a time per spec. */
export function useCalendarRange() {
  const [range, setRange] = useState(() => getDefaultRange())

  // Spec: shift by 2 weeks (14 days) per click
  const shiftRange = (weeks: number) =>
    setRange((prev) =>
      clampRange(
        new Date(prev.start.getTime() + weeks * 14 * MS_PER_DAY),
        new Date(prev.end.getTime() + weeks * 14 * MS_PER_DAY),
        'start',
      ),
    )

  const jumpToDate = (date: Date) => setRange(getRangeForDate(date))
  const resetRange = () => setRange(getDefaultRange())

  const weeks = useMemo(() => getRollingGrid(range.start, range.end), [range])
  const headerLabel = useMemo(() => formatRangeLabel(range.start, range.end), [range])

  const todayCol = useMemo(() => {
    for (const week of weeks) {
      const idx = week.findIndex((d) => d.isToday)
      if (idx !== -1) return idx
    }
    return -1
  }, [weeks])

  return {
    range,
    setRange,
    shiftRange,
    jumpToDate,
    resetRange,
    weeks,
    headerLabel,
    todayCol,
  }
}
