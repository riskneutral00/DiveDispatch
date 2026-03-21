'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { skylinePack, type BookingSpan } from '@/lib/utils/skyline-packer'
import { BAR_ROW_HEIGHT } from '@/components/booking/booking-bar'
import { DAY_CELL_PILLS_MAX_HEIGHT } from '@/lib/constants/calendar-config'
import { CalendarLegend } from '@/components/booking/calendar-legend'
import { UrgentBookingStrip } from '@/components/booking/urgent-booking-strip'
import { GlassCard } from '@/components/glass'
import { courseLabel } from '@/lib/constants/course-catalog'
import { buildBarSubLabel } from '@/lib/utils/build-bar-sub-label'
import {
  useCalendarRange,
  getDaysOfWeek,
  deriveStatus,
  parseDateLocal,
  toISODateString,
} from '@/lib/hooks/use-calendar-range'
import { LOCKING_STATUSES, STATUS_COLORS, STATUS_OPACITY, STATUS_BORDER_STYLE, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { CalendarBooking } from '../../../convex/bookings'


interface BookingCalendarProps {
  bookings?: CalendarBooking[]
  blockedDates?: string[]
  onBookingClick?: (id: string) => void
  onDateClick?: (date: string) => void
  onHiddenStatusesChange?: (hiddenStatuses: Set<CalendarDisplayStatus>) => void
  onRangeChange?: (start: string, end: string) => void
  onUrgentCancel?: (bookingId: string) => void
  legendStatuses?: CalendarDisplayStatus[]
  allDraftsUrgent?: boolean
  viewerRole?: string
  footerAction?: React.ReactNode
  className?: string
}

function buildBarLabel(booking: CalendarBooking): string {
  const types = booking.activityType
  if (types.length === 2 && types.includes('OW') && types.includes('AOW')) {
    return 'O + A'
  }
  return types.map(courseLabel).join(', ') || 'Booking'
}

export function BookingCalendar({
  bookings = [],
  blockedDates,
  onBookingClick,
  onDateClick,
  onHiddenStatusesChange,
  onRangeChange,
  onUrgentCancel,
  legendStatuses,
  allDraftsUrgent = false,
  viewerRole,
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
  const dayHeaders = getDaysOfWeek()

  // Derive display statuses and filter out hidden/null
  const resolvedBookings = useMemo(() => {
    const result: (CalendarBooking & { displayStatus: CalendarDisplayStatus })[] = []
    for (const b of bookings) {
      const status = deriveStatus(b, todayStr, allDraftsUrgent)
      if (status !== null && !hiddenStatuses.has(status)) {
        result.push({ ...b, displayStatus: status })
      }
    }
    return result
  }, [bookings, todayStr, hiddenStatuses, allDraftsUrgent])

  // Dates with active/upcoming/completed bookings that cannot be blocked
  const lockedDatesSet = useMemo(() => {
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
  }, [resolvedBookings])

  // Per-week urgent bookings — assigned to the week containing startDate
  const urgentPerWeek = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].dateString
      const weekEnd = week[6].dateString
      return resolvedBookings.filter((b) => {
        if (b.displayStatus !== 'Urgent') return false
        // Assign to the week containing startDate (or first visible week if before range)
        return b.startDate >= weekStart && b.startDate <= weekEnd
      })
    })
  }, [weeks, resolvedBookings])

  // Bookings with startDate before visible range → assign to week 0
  const earlyUrgent = useMemo(() => {
    if (weeks.length === 0) return []
    const firstDate = weeks[0][0].dateString
    return resolvedBookings.filter(
      (b) => b.displayStatus === 'Urgent' && b.startDate < firstDate,
    )
  }, [weeks, resolvedBookings])

  // Merge early urgents into week 0
  const urgentPerWeekFinal = useMemo(() => {
    if (urgentPerWeek.length === 0) return urgentPerWeek
    const result = [...urgentPerWeek]
    if (earlyUrgent.length > 0) {
      result[0] = [...earlyUrgent, ...result[0]]
    }
    return result
  }, [urgentPerWeek, earlyUrgent])

  // Per-week packing
  const weekBookings = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].dateString
      const weekEnd = week[6].dateString

      const spans: BookingSpan[] = []

      for (const booking of resolvedBookings) {
        if (booking.displayStatus === 'Urgent') continue
        if (booking.endDate < weekStart || booking.startDate > weekEnd) continue

        const startCol = Math.max(
          0,
          week.findIndex((d) => d.dateString >= booking.startDate),
        )
        const endIdx = week.findIndex((d) => d.dateString > booking.endDate)
        const endCol = endIdx === -1 ? 6 : endIdx - 1

        const isMultiDay = booking.startDate !== booking.endDate
        const isContinuation = booking.startDate < weekStart

        if (startCol <= endCol) {
          spans.push({
            id: booking._id,
            startCol,
            endCol,
            label: buildBarLabel(booking),
            status: isMultiDay ? 'MultiDay' : booking.displayStatus,
            continuation: isContinuation,
          })
        }
      }

      return skylinePack(spans)
    })
  }, [weeks, resolvedBookings])

  return (
    <div data-testid="booking-calendar" className={`flex flex-col ${className ?? ''}`}>
      {/* ── Header card ── */}
      <GlassCard padding="none" hoverable>
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

        {/* Day-of-week labels */}
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            <div className="grid grid-cols-7">
              {dayHeaders.map((day, i) => (
                <div
                  key={day}
                  className="py-1.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest"
                  style={{
                    color:
                      i === todayCol
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Week rows + inter-week gaps ── */}
      {weeks.map((week, wi) => {
        const packed = weekBookings[wi]
        const weekUrgent = urgentPerWeekFinal[wi] ?? []

        return (
          <div key={wi}>
            {/* Fixed 28px gap above each week — urgent pills centered inside when present */}
            <div className="h-7 flex items-center justify-center">
              {weekUrgent.length > 0 && onUrgentCancel && (
                <UrgentBookingStrip
                  bookings={weekUrgent}
                  onBookingClick={onBookingClick}
                  onCancel={onUrgentCancel}
                />
              )}
            </div>

            {/* Day island grid — no wrapping GlassCard */}
            <div className="grid grid-cols-7 gap-1.5 min-w-[320px]">
              {week.map((day, di) => {
                const isLocked = lockedDatesSet.has(day.dateString)
                const isPast = day.dateString < todayStr
                const isBlocked = !blockedHidden && blockedDatesSet.has(day.dateString)
                const dayBars = packed.filter((b) => b.startCol <= di && b.endCol >= di)

                return (
                  <div
                    key={day.dateString}
                    data-testid={`cell-${day.dateString}`}
                    className={`glass flex flex-col p-1.5 min-h-[56px] rounded-lg ${
                      isLocked
                        ? 'cursor-default'
                        : isPast
                          ? 'glass-surface cursor-default'
                          : 'glass-surface cursor-pointer'
                    }`}
                    style={{
                      background: isBlocked
                        ? 'rgba(167, 139, 250, 0.12)'
                        : day.isToday
                          ? 'rgba(52, 211, 153, 0.08)'
                          : undefined,
                    }}
                    onClick={isLocked || isPast ? undefined : () => onDateClick?.(day.dateString)}
                  >
                    {/* Date number */}
                    <span
                      className="text-[10px] leading-none mb-1 select-none pointer-events-none"
                      style={{
                        color: isBlocked
                          ? 'rgba(255,255,255,0.6)'
                          : day.isToday
                            ? 'rgba(52, 211, 153, 0.35)'
                            : 'color-mix(in srgb, var(--color-text-primary) 18%, transparent)',
                        fontWeight: day.isToday ? 700 : 500,
                      }}
                    >
                      {day.dayOfMonth}
                    </span>

                    {/* Booking pills — scroll after 5 */}
                    <div
                      data-testid={`day-pills-${day.dateString}`}
                      className="overflow-y-auto"
                      style={{ height: `${DAY_CELL_PILLS_MAX_HEIGHT}px` }}
                    >
                    {dayBars.map((bar) => {
                      const booking = resolvedBookings.find((b) => b._id === bar.id)
                      const isMultiDay = bar.status === 'MultiDay'
                      const statusColors = STATUS_COLORS[bar.status]
                      const opacity = STATUS_OPACITY[bar.status]
                      const borderStyle = STATUS_BORDER_STYLE[bar.status]
                      const subLabel = booking ? buildBarSubLabel(booking, viewerRole) : undefined

                      // Label-follows-today: show label only on the "active" day cell
                      let showLabel = true
                      if (isMultiDay && booking) {
                        const isToday = day.dateString === todayStr
                        const bookingNotStarted = todayStr < booking.startDate
                        const bookingPast = todayStr > booking.endDate
                        const isStartDay = di === bar.startCol
                        showLabel = isToday || ((bookingNotStarted || bookingPast) && isStartDay)
                      }

                      return (
                        <button
                          key={bar.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onBookingClick?.(bar.id)
                          }}
                          className={`w-full rounded-r-[6px] px-1.5 text-left transition-[transform,filter] duration-150 ease-out hover:scale-[1.01] hover:brightness-95 mb-0.5${bar.status === 'Urgent' ? ' urgent-pulse' : ''}`}
                          style={{
                            height: `${BAR_ROW_HEIGHT - 2}px`,
                            opacity,
                            background: bar.status === 'Urgent'
                              ? 'var(--color-status-urgent)'
                              : statusColors.bgVar,
                            color: bar.status === 'Urgent'
                              ? '#ffffff'
                              : statusColors.textVar,
                            borderLeft: `3px ${borderStyle} ${statusColors.borderVar}`,
                            borderTop: `1px ${borderStyle} ${statusColors.borderVar}`,
                            borderRight: `1px ${borderStyle} ${statusColors.borderVar}`,
                            borderBottom: `1px ${borderStyle} ${statusColors.borderVar}`,
                            cursor: onBookingClick ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {showLabel && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              lineHeight: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {bar.label}{subLabel ? ` · ${subLabel}` : ''}
                          </span>
                          )}
                        </button>
                      )
                    })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Equal 28px gap: last week → footer */}
      <div className="h-7" />

      {/* ── Footer (legend) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3">
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

    </div>
  )
}
