'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { skylinePack, getMaxRows, type BookingSpan } from '@/lib/utils/skyline-packer'
import { BookingBar, BAR_ROW_HEIGHT } from '@/components/booking/booking-bar'
import { CalendarLegend } from '@/components/booking/calendar-legend'
import { CalendarShell } from '@/components/booking/calendar-shell'
import {
  useCalendarRange,
  deriveStatus,
  parseDateLocal,
  toISODateString,
} from '@/lib/hooks/use-calendar-range'
import { LOCKING_STATUSES, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'

const MIN_ROWS = 4
const MIN_BAR_AREA_HEIGHT = MIN_ROWS * BAR_ROW_HEIGHT

interface BookingCalendarProps {
  bookings?: CalendarBooking[]
  blockedDates?: string[]
  onBookingClick?: (id: string) => void
  onDateClick?: (date: string) => void
  onHiddenStatusesChange?: (hiddenStatuses: Set<CalendarDisplayStatus>) => void
  onRangeChange?: (start: string, end: string) => void
  legendStatuses?: CalendarDisplayStatus[]
  footerAction?: React.ReactNode
  className?: string
}

function buildBarLabel(booking: CalendarBooking): string {
  const activity = booking.activityType.join(', ') || 'Booking'
  return activity
}

function buildBarSubLabel(booking: CalendarBooking): string | undefined {
  return booking.customerName ?? undefined
}

export function BookingCalendar({
  bookings = [],
  blockedDates,
  onBookingClick,
  onDateClick,
  onHiddenStatusesChange,
  onRangeChange,
  legendStatuses,
  footerAction,
  className,
}: BookingCalendarProps) {
  const { range, shiftRange, jumpToDate, resetRange, weeks, headerLabel, todayCol } =
    useCalendarRange()

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    onRangeChange?.(toISODateString(range.start), toISODateString(range.end))
  }, [range, onRangeChange])

  const [hiddenStatuses, setHiddenStatuses] = useState(
    () => new Set<CalendarDisplayStatus>(['Completed']),
  )
  const [blockedHidden, setBlockedHidden] = useState(false)
  const toggleBlocked = useCallback(() => setBlockedHidden((h) => !h), [])

  const toggleStatus = (status: CalendarDisplayStatus) => {
    const next = new Set(hiddenStatuses)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setHiddenStatuses(next)
    onHiddenStatusesChange?.(next)
  }

  const todayStr = useMemo(() => toISODateString(new Date()), [])
  const blockedDatesSet = useMemo(() => new Set(blockedDates ?? []), [blockedDates])

  // Derive display statuses and filter out hidden/null
  const resolvedBookings = useMemo(() => {
    const result: (CalendarBooking & { displayStatus: CalendarDisplayStatus })[] = []
    for (const b of bookings) {
      const status = deriveStatus(b, todayStr)
      if (status !== null && !hiddenStatuses.has(status)) {
        result.push({ ...b, displayStatus: status })
      }
    }
    return result
  }, [bookings, todayStr, hiddenStatuses])

  // Dates with active/upcoming/completed bookings that cannot be blocked
  const lockedDatesSet = useMemo(() => {
    if (!onDateClick) return new Set<string>()
    const locked = new Set<string>()
    for (const b of resolvedBookings) {
      if (!LOCKING_STATUSES.has(b.displayStatus)) continue
      const cur = parseDateLocal(b.startDate)
      const end = parseDateLocal(b.endDate)
      while (cur <= end) {
        locked.add(toISODateString(cur))
        cur.setDate(cur.getDate() + 1)
      }
    }
    return locked
  }, [resolvedBookings, onDateClick])

  // Per-week packing
  const weekBookings = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].dateString
      const weekEnd = week[6].dateString

      const spans: BookingSpan[] = []

      for (const booking of resolvedBookings) {
        if (booking.endDate < weekStart || booking.startDate > weekEnd) continue

        const startCol = Math.max(
          0,
          week.findIndex((d) => d.dateString >= booking.startDate),
        )
        const endIdx = week.findIndex((d) => d.dateString > booking.endDate)
        const endCol = endIdx === -1 ? 6 : endIdx - 1

        if (startCol <= endCol) {
          spans.push({
            id: booking._id,
            startCol,
            endCol,
            label: buildBarLabel(booking),
            status: booking.displayStatus,
          })
        }
      }

      return skylinePack(spans)
    })
  }, [weeks, resolvedBookings])

  const header = (
    <div
      className="px-3 sm:px-5 py-2"
      style={{ borderBottom: '1px solid var(--color-glass-border)' }}
    >
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => { setExpanded(false); shiftRange(-1) }}
          className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Previous 2 weeks"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-semibold text-base sm:text-lg min-w-[12rem] text-center hover:underline underline-offset-4"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {headerLabel}
        </button>

        <button
          type="button"
          onClick={() => { setExpanded(false); shiftRange(1) }}
          className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Next 2 weeks"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month/date jump */}
      {expanded && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>Jump to:</span>
            <input
              type="month"
              className="rounded-lg px-2 py-1 text-sm border"
              style={{
                background: 'var(--color-glass-bg)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-glass-border)',
              }}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m] = e.target.value.split('-').map(Number)
                  jumpToDate(new Date(y, m - 1, 1))
                  setExpanded(false)
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => { resetRange(); setExpanded(false) }}
            className="text-sm hover:underline underline-offset-4"
            style={{ color: 'var(--color-primary)' }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex w-full items-center">
      <div className="flex-1" />
      <CalendarLegend
        statuses={legendStatuses}
        hiddenStatuses={hiddenStatuses}
        onToggle={toggleStatus}
        showBlocked={!!onDateClick || blockedDatesSet.size > 0}
        blockedHidden={blockedHidden}
        onToggleBlocked={toggleBlocked}
        className="justify-center"
      />
      <div className="flex-1 flex justify-end">{footerAction}</div>
    </div>
  )

  return (
    <CalendarShell
      className={className}
      todayCol={todayCol}
      header={header}
      footer={footer}
    >
      <div>
        {weeks.map((week, wi) => {
          const packed = weekBookings[wi]
          const barAreaHeight = Math.max(getMaxRows(packed) * BAR_ROW_HEIGHT, MIN_BAR_AREA_HEIGHT)
          const isLast = wi === weeks.length - 1

          return (
            <div
              key={wi}
              style={isLast ? {} : { borderBottom: '1px solid var(--color-glass-border)' }}
            >
              <div className="relative" style={{ height: `${barAreaHeight}px` }}>
                {/* Per-day click zones (below bars) */}
                {onDateClick &&
                  week.map((day, di) => {
                    const isLocked =
                      lockedDatesSet.has(day.dateString) || day.dateString < todayStr
                    return (
                      <div
                        key={`click-${day.dateString}`}
                        className="absolute inset-y-0"
                        style={{
                          left: `${(di / 7) * 100}%`,
                          width: `${(1 / 7) * 100}%`,
                          zIndex: 1,
                          cursor: isLocked ? 'default' : 'pointer',
                        }}
                        onClick={isLocked ? undefined : () => onDateClick(day.dateString)}
                      />
                    )
                  })}

                {/* Blocked date column overlays */}
                {!blockedHidden &&
                  week.map((day, di) => {
                    if (!blockedDatesSet.has(day.dateString)) return null
                    return (
                      <div
                        key={`blocked-${day.dateString}`}
                        className="absolute inset-y-0 pointer-events-none"
                        style={{
                          left: `${(di / 7) * 100}%`,
                          width: `${(1 / 7) * 100}%`,
                          zIndex: 0,
                          background:
                            'color-mix(in srgb, var(--color-text-secondary) 12%, transparent)',
                        }}
                      />
                    )
                  })}

                {/* Today highlight */}
                {week.map((day, di) => {
                  if (!day.isToday) return null
                  return (
                    <div
                      key={`today-${day.dateString}`}
                      className="absolute inset-y-0 pointer-events-none"
                      style={{
                        left: `${(di / 7) * 100}%`,
                        width: `${(1 / 7) * 100}%`,
                        zIndex: 0,
                        background:
                          'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                      }}
                    />
                  )
                })}

                {/* Date number watermarks */}
                {week.map((day, di) => {
                  const isBlockedVisible =
                    !blockedHidden && blockedDatesSet.has(day.dateString)
                  return (
                    <span
                      key={day.dateString}
                      className="absolute select-none pointer-events-none font-[500] leading-none"
                      style={{
                        top: '4px',
                        left: `calc(${(di / 7) * 100}% + 4px)`,
                        fontSize: 'clamp(12px, 3.5vw, 24px)',
                        zIndex: 2,
                        color: isBlockedVisible
                          ? 'rgba(255,255,255,0.6)'
                          : day.isToday
                            ? 'color-mix(in srgb, var(--color-primary) 25%, transparent)'
                            : 'color-mix(in srgb, var(--color-text-primary) 18%, transparent)',
                        fontWeight: day.isToday ? 700 : 500,
                      }}
                    >
                      {day.dayOfMonth}
                    </span>
                  )
                })}

                {/* Booking bars */}
                {packed.map((bar) => {
                  const booking = resolvedBookings.find((b) => b._id === bar.id)
                  return (
                    <BookingBar
                      key={`${bar.id}-${wi}`}
                      id={bar.id}
                      label={bar.label}
                      subLabel={booking ? buildBarSubLabel(booking) : undefined}
                      status={bar.status}
                      startCol={bar.startCol}
                      endCol={bar.endCol}
                      row={bar.row}
                      onClick={onBookingClick}
                      className="z-[3]"
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </CalendarShell>
  )
}
