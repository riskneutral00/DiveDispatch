'use client'

import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarRange } from '@/lib/hooks/use-calendar-range'
import { getDaysOfWeek } from '@/lib/utils/calendar-range'
import { toISODateString } from '@/lib/utils/date'
import type { VesselCalendarData, VesselDailyCapacity } from '../../../convex/boatWidget'

interface VesselCalendarProps {
  data: VesselCalendarData | null | undefined
  onRangeChange?: (start: string, end: string) => void
  className?: string
}

function capacityColor(booked: number, total: number): string {
  if (total === 0) return 'var(--color-text-secondary)'
  const pct = booked / total
  if (pct >= 1) return 'var(--color-primary)'
  if (pct >= 0.8) return 'var(--color-primary)'
  if (pct >= 0.5) return 'var(--color-accent)'
  if (pct > 0) return 'var(--color-secondary)'
  return 'var(--color-text-secondary)'
}

function capacityBg(booked: number, total: number): string | undefined {
  if (total === 0) return undefined
  if (booked >= total) return 'var(--color-primary)'
  return undefined
}

function capacityTextColor(booked: number, total: number): string {
  if (total > 0 && booked >= total) return 'var(--color-text-on-primary)'
  return capacityColor(booked, total)
}

export function VesselCalendar({ data, onRangeChange, className }: VesselCalendarProps) {
  const { range, shiftRange, weeks, headerLabel, todayCol } = useCalendarRange()

  const rangeStart = useMemo(() => toISODateString(range.start), [range.start])
  const rangeEnd = useMemo(() => toISODateString(range.end), [range.end])

  useEffect(() => {
    onRangeChange?.(rangeStart, rangeEnd)
  }, [rangeStart, rangeEnd, onRangeChange])

  const daysOfWeek = getDaysOfWeek()
  const vessels = data?.vessels ?? []

  return (
    <div data-testid="vessel-calendar" className={`flex flex-col ${className ?? ''}`}>
      <div className="flex flex-col items-center py-2">
        <div className="glass-container glass-surface transition rounded-theme inline-flex items-center gap-3 px-3 py-1">
          <button
            type="button"
            onClick={() => shiftRange(-1)}
            className="p-1.5 rounded-[var(--border-radius-button)] transition-opacity duration-theme hover:opacity-70 text-secondary"
            aria-label="Previous 2 weeks"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="font-semibold text-card-title min-w-[12rem] text-center text-primary font-heading"
          >
            {headerLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftRange(1)}
            className="p-1.5 rounded-[var(--border-radius-button)] transition-opacity duration-theme hover:opacity-70 text-secondary"
            aria-label="Next 2 weeks"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="mb-2">
            {weekIdx === 0 && (
              <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-px mb-1">
                <div />
                {daysOfWeek.map((label, i) => (
                  <div
                    key={label}
                    className={`text-center text-label font-medium py-1 ${
                      i === todayCol ? 'text-accent' : 'text-secondary'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-px mb-0.5">
              <div />
              {week.map((day) => (
                <div
                  key={day.dateString}
                  className={`text-center text-label ${
                    day.isToday
                      ? 'text-accent font-bold'
                      : day.isCurrentMonth
                        ? 'text-primary'
                        : 'text-secondary opacity-50'
                  }`}
                >
                  {day.dayOfMonth}
                </div>
              ))}
            </div>

            {vessels.map((vessel) => (
              <div
                key={`${vessel.unitId}-${weekIdx}`}
                className="grid grid-cols-[120px_repeat(7,1fr)] gap-px"
              >
                <div className="flex items-center gap-1.5 pr-2 min-h-[32px] sticky left-0 z-10 glass-surface" /* design-ok */>
                  {weekIdx === 0 && (
                    <>
                      <span className="text-label font-medium text-primary truncate">
                        {vessel.name}
                      </span>
                      <span className="text-[10px] text-secondary shrink-0"> {/* design-ok */}
                        {vessel.boatType.replace('_', ' ')}
                      </span>
                    </>
                  )}
                </div>

                {week.map((day) => {
                  const cap: VesselDailyCapacity = vessel.dailyCapacity[day.dateString] ?? {
                    booked: 0,
                    total: vessel.maxPax,
                  }
                  const bg = capacityBg(cap.booked, cap.total)
                  const textColor = capacityTextColor(cap.booked, cap.total)

                  return (
                    <div
                      key={day.dateString}
                      className="flex items-center justify-center min-h-[32px] rounded-[var(--border-radius-button)] transition-colors duration-theme"
                      style={{
                        backgroundColor: bg,
                        ...(day.isToday && !bg
                          ? { borderTop: '2px solid var(--color-accent)' }
                          : {}),
                      }}
                      role="gridcell"
                      aria-label={`${vessel.name}, ${day.dateString}, ${cap.booked} of ${cap.total} seats booked`}
                    >
                      <span
                        className="text-label font-mono tabular-nums"
                        style={{ color: textColor }}
                      >
                        {cap.booked}/{cap.total}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}

            {vessels.length === 0 && (
              <div className="col-span-8 text-center text-body text-secondary py-4">
                No vessels found. Add boats in Workspace.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
