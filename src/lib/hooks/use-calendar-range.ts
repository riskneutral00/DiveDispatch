'use client'

import { useState, useMemo } from 'react'
import { DAY_MS } from '@/lib/constants/time'
import {
  clampRange,
  formatRangeLabel,
  getDefaultRange,
  getRangeForDate,
  getRollingGrid,
} from '@/lib/utils/calendar-range'

export type { CalendarDay, CalendarWeek } from '@/lib/utils/calendar-range'
export { deriveStatus, getDaysOfWeek } from '@/lib/utils/calendar-range'

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** 4-week rolling window, shifted 2 weeks at a time per spec. */
export function useCalendarRange() {
  const [range, setRange] = useState(() => getDefaultRange())

  // Spec: shift by 2 weeks (14 days) per click
  const shiftRange = (weeks: number) =>
    setRange((prev) =>
      clampRange(
        new Date(prev.start.getTime() + weeks * 14 * DAY_MS),
        new Date(prev.end.getTime() + weeks * 14 * DAY_MS),
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
