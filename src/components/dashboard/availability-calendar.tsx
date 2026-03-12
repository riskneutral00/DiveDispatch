'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard, GlassBadge } from '@/components/glass'
import { CalendarGrid } from '@/components/common/calendar-grid'
import type { ConfirmedScheduleItem } from '../../../convex/resourceQueries'
import type { OpenRequest } from '../../../convex/resourceQueries'

interface AvailabilityCalendarProps {
  confirmedItems?: ConfirmedScheduleItem[]
  openRequests?: OpenRequest[]
}

type DayStatus = 'available' | 'pending' | 'confirmed' | 'busy'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    dates.push(toDateStr(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function buildMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d)
    dates.push(toDateStr(date))
  }
  return dates
}

export function AvailabilityCalendar({
  confirmedItems = [],
  openRequests = [],
}: AvailabilityCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthDates = buildMonthDates(year, month)
  const unavailableIds = useQuery(api.availability.getUnavailableUnitIdsForDates, {
    dates: monthDates,
  })

  // Build date status from confirmed + pending data
  const confirmedDates = new Set<string>()
  for (const item of confirmedItems) {
    for (const s of item.sessions) {
      confirmedDates.add(s.date)
    }
  }

  const pendingDates = new Set<string>()
  for (const req of openRequests) {
    for (const d of getDatesInRange(req.startDate, req.endDate)) {
      pendingDates.add(d)
    }
  }

  function getDayStatus(dateStr: string): DayStatus {
    if (confirmedDates.has(dateStr)) return 'confirmed'
    if (pendingDates.has(dateStr)) return 'pending'
    return 'available'
  }

  const monthName = new Date(year, month, 1).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedStatus = selectedDate ? getDayStatus(selectedDate) : null

  return (
    <GlassCard padding="md">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          {monthName}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        renderDay={(date) => {
          const ds = toDateStr(date)
          const status = getDayStatus(ds)
          const isToday = ds === toDateStr(today)
          const isSelected = ds === selectedDate

          return (
            <button
              onClick={() => setSelectedDate(isSelected ? null : ds)}
              className="w-full aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all hover:scale-[1.05]"
              style={{
                background: isSelected
                  ? 'var(--color-primary)'
                  : status === 'confirmed'
                    ? 'color-mix(in srgb, var(--color-success) 25%, transparent)'
                    : status === 'pending'
                      ? 'color-mix(in srgb, var(--color-warning) 25%, transparent)'
                      : isToday
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'transparent',
                color: isSelected
                  ? 'var(--color-text-on-primary)'
                  : 'var(--color-text-primary)',
                border: isToday && !isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                transitionDuration: 'var(--transition-speed)',
              }}
            >
              {date.getDate()}
            </button>
          )
        }}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} />
          Confirmed
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-warning)' }} />
          Pending
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-glass-border)' }} />
          Available
        </div>
      </div>

      {/* Day detail */}
      {selectedDate && (
        <div
          className="mt-3 pt-3 space-y-1"
          style={{ borderTop: '1px solid var(--color-glass-border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {selectedDate}
          </p>
          {selectedStatus === 'confirmed' && (
            <GlassBadge variant="success" size="sm" dot>Confirmed session</GlassBadge>
          )}
          {selectedStatus === 'pending' && (
            <GlassBadge variant="warning" size="sm" dot>Pending request</GlassBadge>
          )}
          {selectedStatus === 'available' && (
            <GlassBadge variant="default" size="sm">Available</GlassBadge>
          )}
          {unavailableIds === undefined && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Loading availability…</p>
          )}
        </div>
      )}
    </GlassCard>
  )
}
