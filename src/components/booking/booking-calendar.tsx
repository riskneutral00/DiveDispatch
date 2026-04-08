'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { skylinePack, type BookingSpan } from '@/lib/utils/skyline-packer'
import { DroppableDateCell } from '@/components/booking/droppable-date-cell'
import { BAR_ROW_HEIGHT, DAY_CELL_PILLS_MAX_HEIGHT } from '@/lib/constants/calendar-config'
import { CalendarLegend } from '@/components/booking/calendar-legend'
import { UrgentBookingStrip } from '@/components/booking/urgent-booking-strip'
import { courseLabel } from '@/lib/constants/course-catalog'
import { buildBarSubLabel } from '@/lib/utils/build-bar-sub-label'
import { getBarBorderColor } from '@/lib/booking/bar-styles'
import { useCalendarRange } from '@/lib/hooks/use-calendar-range'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import { deriveStatus, getDaysOfWeek, getFloorDate } from '@/lib/utils/calendar-range'
import { parseDateLocal, toISODateString } from '@/lib/utils/date'
import { LOCKING_STATUSES, STATUS_COLORS, STATUS_OPACITY, STATUS_BORDER_STYLE, type CalendarDisplayStatus } from '@/lib/constants/status-colors'
import type { StatusColorSet } from '@/lib/constants/vessel-colors'
import type { CustomLegendItem } from '@/components/booking/calendar-legend'
import type { CalendarBooking } from '../../../convex/bookings'

export type CustomCategories = {
  items: CustomLegendItem[]
  getCategoryKey: (booking: CalendarBooking) => string
}

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
  droppableEnabled?: boolean
  customCategories?: CustomCategories
  customLabel?: (booking: CalendarBooking) => { label: string; subLabel?: string }
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  droppableEnabled,
  customCategories,
  customLabel,
}: BookingCalendarProps) {
  const { range, shiftRange, jumpToDate, resetRange, weeks, headerLabel, todayCol } =
    useCalendarRange()

  const [expanded, setExpanded] = useState(false)
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const viewYear = range.start.getFullYear()
  const viewMonth = range.start.getMonth()
  const [pickerYear, setPickerYear] = useState(viewYear)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPickerYear(viewYear) }, [viewYear])

  const collapseExpanded = useCallback(() => setExpanded(false), [])
  useClickOutside(pickerRef, collapseExpanded, expanded)

  useEffect(() => {
    onRangeChange?.(toISODateString(range.start), toISODateString(range.end))
  }, [range, onRangeChange])

  const [hiddenStatuses, setHiddenStatuses] = useState(
    () => new Set<CalendarDisplayStatus>(['Completed']),
  )
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set<string>())
  const [blockedHidden, setBlockedHidden] = useState(false)
  const toggleBlocked = useCallback(() => setBlockedHidden((h) => !h), [])

  const toggleStatus = (status: CalendarDisplayStatus) => {
    const next = new Set(hiddenStatuses)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setHiddenStatuses(next)
    onHiddenStatusesChange?.(next)
  }

  const toggleCategory = useCallback((key: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const categoryColorMap = useMemo(() => {
    if (!customCategories) return null
    const map = new Map<string, StatusColorSet>()
    for (const item of customCategories.items) {
      map.set(item.key, item.color)
    }
    return map
  }, [customCategories])

  const todayStr = useMemo(() => toISODateString(new Date()), [])
  const blockedDatesSet = useMemo(() => new Set(blockedDates ?? []), [blockedDates])
  const dayHeaders = getDaysOfWeek()

  const resolvedBookings = useMemo(() => {
    const result: (CalendarBooking & { displayStatus: CalendarDisplayStatus })[] = []
    for (const b of bookings) {
      if (customCategories) {
        const key = customCategories.getCategoryKey(b)
        if (!hiddenCategories.has(key)) {
          result.push({ ...b, displayStatus: 'Active' })
        }
      } else {
        const status = deriveStatus(b, todayStr, allDraftsUrgent)
        if (status !== null && !hiddenStatuses.has(status)) {
          result.push({ ...b, displayStatus: status })
        }
      }
    }
    return result
  }, [bookings, todayStr, hiddenStatuses, hiddenCategories, allDraftsUrgent, customCategories])

  const lockedDatesSet = useMemo(() => {
    const locked = new Set<string>()
    for (const b of resolvedBookings) {
      if (!customCategories && !LOCKING_STATUSES.has(b.displayStatus)) continue
      const cur = parseDateLocal(b.startDate)
      const end = parseDateLocal(b.endDate)
      while (cur <= end) {
        locked.add(toISODateString(cur))
        cur.setDate(cur.getDate() + 1)
      }
    }
    return locked
  }, [resolvedBookings, customCategories])

  const urgentPerWeek = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].dateString
      const weekEnd = week[6].dateString
      return resolvedBookings.filter((b) => {
        if (b.displayStatus !== 'Urgent') return false
        return b.startDate >= weekStart && b.startDate <= weekEnd
      })
    })
  }, [weeks, resolvedBookings])

  const earlyUrgent = useMemo(() => {
    if (weeks.length === 0) return []
    const firstDate = weeks[0][0].dateString
    return resolvedBookings.filter(
      (b) => b.displayStatus === 'Urgent' && b.startDate < firstDate,
    )
  }, [weeks, resolvedBookings])

  const urgentPerWeekFinal = useMemo(() => {
    if (urgentPerWeek.length === 0) return urgentPerWeek
    const result = [...urgentPerWeek]
    if (earlyUrgent.length > 0) {
      result[0] = [...earlyUrgent, ...result[0]]
    }
    return result
  }, [urgentPerWeek, earlyUrgent])

  const weekBookings = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0].dateString
      const weekEnd = week[6].dateString

      const spans: BookingSpan[] = []

      for (const booking of resolvedBookings) {
        if (!customCategories && booking.displayStatus === 'Urgent') continue
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
          const labelResult = customLabel ? customLabel(booking) : null
          spans.push({
            id: booking._id,
            startCol,
            endCol,
            label: labelResult ? labelResult.label : buildBarLabel(booking),
            status: booking.displayStatus,
            isMultiDay,
            continuation: isContinuation,
          })
        }
      }

      return skylinePack(spans)
    })
  }, [weeks, resolvedBookings, customCategories, customLabel])

  return (
    <div data-testid="booking-calendar" className={`flex flex-col ${className ?? ''}`}>
      <div className="flex flex-col items-center py-2" ref={pickerRef}>
        <div className="relative inline-flex">
          <div className="glass-container glass-surface transition rounded-theme inline-flex items-center gap-3 px-3 py-1">
            <button
              type="button"
              onClick={() => { setExpanded(false); shiftRange(-1) }}
              className="p-1.5 rounded-theme transition-opacity duration-theme hover:opacity-70 text-secondary"
              aria-label="Previous 2 weeks"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-semibold text-card-title min-w-[12rem] text-center hover:underline underline-offset-4 text-primary font-heading"
            >
              {headerLabel}
            </button>

            <button
              type="button"
              onClick={() => { setExpanded(false); shiftRange(1) }}
              className="p-1.5 rounded-theme transition-opacity duration-theme hover:opacity-70 text-secondary"
              aria-label="Next 2 weeks"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {expanded && (
            <div
              className="absolute z-[var(--z-dropdown)] left-1/2 -translate-x-1/2 mt-2 glass-elevated rounded-theme py-3 px-4"
              style={{
                position: 'absolute',
                top: '100%',
                width: '240px',
                background: 'var(--color-surface-elevated)',
                boxShadow: '0 8px 32px var(--color-glass-shadow-elevated)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => { if (pickerYear > currentYear - 1) setPickerYear((y) => y - 1) }}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--border-radius-button)] transition-opacity duration-theme ${pickerYear <= currentYear - 1 ? 'opacity-30 pointer-events-none' : 'hover:opacity-70'} text-secondary`}
                  aria-label="Previous year"
                >
                  <ChevronLeft size={14} />
                </button>
                <span
                  className="text-body font-semibold text-primary font-heading"
                >
                  {pickerYear}
                </span>
                <button
                  type="button"
                  onClick={() => { if (pickerYear < currentYear + 1) setPickerYear((y) => y + 1) }}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--border-radius-button)] transition-opacity duration-theme ${pickerYear >= currentYear + 1 ? 'opacity-30 pointer-events-none' : 'hover:opacity-70'} text-secondary`}
                  aria-label="Next year"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Month grid — design-ok */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
                {MONTH_LABELS.map((label, i) => {
                  const isCurrentMonth = pickerYear === currentYear && i === currentMonth
                  const isViewMonth = pickerYear === viewYear && i === viewMonth
                  const floor = getFloorDate()
                  const isBeforeFloor = pickerYear < floor.getFullYear() ||
                    (pickerYear === floor.getFullYear() && i < floor.getMonth())
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={isBeforeFloor}
                      onClick={() => {
                        jumpToDate(new Date(pickerYear, i, 1))
                        setExpanded(false)
                      }}
                      className={`glass-container glass-surface transition rounded-[var(--border-radius-button)] py-1.5 text-body font-medium min-h-[44px]${isBeforeFloor ? ' opacity-30 cursor-not-allowed' : ''}`}
                      style={{
                        color: isCurrentMonth ? 'var(--color-status-active)' : 'var(--color-text-primary)',
                        background: isCurrentMonth ? 'var(--color-status-active-bg)' : undefined,
                        borderColor: isViewMonth ? 'var(--color-primary)' : undefined,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => { resetRange(); setPickerYear(currentYear); setExpanded(false) }}
                  className="text-body font-medium transition-opacity duration-theme hover:opacity-80 min-h-[44px] min-w-[44px]"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Today
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto mt-1">
        <div className="min-w-[320px]">
          <div className="grid grid-cols-7"> {/* design-ok */}
            {dayHeaders.map((day, i) => (
              <div
                key={day}
                className="py-1.5 text-center text-[10px] sm:text-label font-bold uppercase tracking-widest" /* design-ok */
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

      {weeks.map((week, wi) => {
        const packed = weekBookings[wi]
        const weekUrgent = urgentPerWeekFinal[wi] ?? []

        return (
          <div key={wi}>
            <div className="h-7 flex items-center justify-center">
              {weekUrgent.length > 0 && onUrgentCancel && (
                <UrgentBookingStrip
                  bookings={weekUrgent}
                  onBookingClick={onBookingClick}
                  onCancel={onUrgentCancel}
                />
              )}
            </div>

            {/* Day island grid — no wrapping Card — design-ok */}
            <div className="grid grid-cols-7 gap-1.5 min-w-[320px]">
              {week.map((day, di) => {
                const isLocked = lockedDatesSet.has(day.dateString)
                const isPast = day.dateString < todayStr
                const isBlocked = !blockedHidden && blockedDatesSet.has(day.dateString)
                const dayBars = packed.filter((b) => b.startCol <= di && b.endCol >= di)

                const cellContent = (
                  <div
                    data-testid={`cell-${day.dateString}`}
                    className={`glass-container transition flex flex-col p-1.5 min-h-[56px] rounded-theme ${
                      isLocked
                        ? 'cursor-default'
                        : isPast
                          ? 'glass-surface cursor-default'
                          : 'glass-surface cursor-pointer'
                    }`}
                    style={{
                      background: isBlocked
                        ? 'var(--color-blocked-bg)'
                        : day.isToday
                            ? 'var(--color-status-active-bg)'
                            : undefined,
                    }}
                    onClick={isLocked || isPast ? undefined : () => onDateClick?.(day.dateString)}
                  >
                    <span
                      className="text-[10px] leading-none mb-1 select-none pointer-events-none" /* design-ok */
                      style={{
                        color: isBlocked
                          ? 'var(--color-date-blocked)'
                          : day.isToday
                            ? 'var(--color-status-active)'
                            : 'var(--color-date-watermark)',
                        fontWeight: day.isToday ? 700 : 500,
                      }}
                    >
                      {day.dayOfMonth}
                    </span>

                    <div
                      data-testid={`day-pills-${day.dateString}`}
                      className="overflow-y-auto overflow-x-hidden"
                      style={{ height: `${DAY_CELL_PILLS_MAX_HEIGHT}px` }}
                    >
                    {dayBars.map((bar) => {
                      const booking = resolvedBookings.find((b) => b._id === bar.id)
                      const categoryKey = booking && customCategories ? customCategories.getCategoryKey(booking) : null
                      const catColor = categoryKey && categoryColorMap ? categoryColorMap.get(categoryKey) : null
                      const isMultiDay = !!bar.isMultiDay
                      const statusColors = catColor ?? STATUS_COLORS[bar.status]
                      const opacity = catColor ? 1.0 : STATUS_OPACITY[bar.status]
                      const borderStyle: 'solid' | 'dashed' = catColor ? 'solid' : STATUS_BORDER_STYLE[bar.status]
                      const borderColor = catColor ? statusColors.borderVar : getBarBorderColor(bar.status, isMultiDay, statusColors.borderVar)
                      const customLabelResult = booking && customLabel ? customLabel(booking) : null
                      const subLabel = customLabelResult ? customLabelResult.subLabel : (booking ? buildBarSubLabel(booking, viewerRole) : undefined)
                      const isReferral = !customCategories && (booking?.isReferral ?? false)

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
                          data-referral={isReferral ? 'true' : undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            onBookingClick?.(bar.id)
                          }}
                          className={`w-full rounded-r-[var(--border-radius-button)] px-1.5 text-left transition-[filter] ease-out hover:brightness-95 mb-0.5${bar.status === 'Urgent' ? ' urgent-pulse' : ''}`}
                          style={{
                            transitionDuration: 'var(--transition-speed)',
                            height: `${BAR_ROW_HEIGHT - 2}px`,
                            minHeight: '44px',
                            opacity: isReferral ? (opacity * 0.8) : opacity,
                            background: bar.status === 'Urgent'
                              ? 'var(--color-status-urgent)'
                              : statusColors.bgVar,
                            color: bar.status === 'Urgent'
                              ? 'var(--color-text-on-primary)'
                              : statusColors.textVar,
                            borderLeft: `3px ${isReferral ? 'dashed' : borderStyle} ${borderColor}`,
                            borderTop: `1px ${borderStyle} ${borderColor}`,
                            borderRight: `1px ${borderStyle} ${borderColor}`,
                            borderBottom: `1px ${borderStyle} ${borderColor}`,
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
                            {isReferral ? 'Ref · ' : ''}{bar.label}{subLabel ? ` · ${subLabel}` : ''}
                          </span>
                          )}
                        </button>
                      )
                    })}
                    </div>
                  </div>
                )

                if (droppableEnabled) {
                  return (
                    <DroppableDateCell key={day.dateString} dateString={day.dateString} disabled={isPast || isLocked}>
                      {cellContent}
                    </DroppableDateCell>
                  )
                }

                return (
                  <div key={day.dateString}>
                    {cellContent}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="h-7" />

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3">
        <div className="flex-1" />
        <CalendarLegend
          statuses={customCategories ? undefined : legendStatuses}
          hiddenStatuses={customCategories ? undefined : hiddenStatuses}
          onToggle={customCategories ? undefined : toggleStatus}
          customItems={customCategories?.items}
          hiddenKeys={customCategories ? hiddenCategories : undefined}
          onToggleKey={customCategories ? toggleCategory : undefined}
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
