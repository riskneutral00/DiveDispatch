'use client'

import type { CalendarBooking } from '../../../convex/bookings'

interface BookingCalendarProps {
  bookings: CalendarBooking[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    days.push(toDateStr(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export function BookingCalendar({ bookings, selectedDate, onSelectDate }: BookingCalendarProps) {
  // Build date → count map from active bookings
  const countMap = new Map<string, number>()
  for (const b of bookings) {
    if (b.status === 'Cancelled') continue
    for (const d of getDaysInRange(b.startDate, b.endDate)) {
      countMap.set(d, (countMap.get(d) ?? 0) + 1)
    }
  }

  // Generate 60-day window centered around today
  const today = toDateStr(new Date())
  const days: string[] = []
  const start = new Date()
  start.setDate(start.getDate() - 7)
  for (let i = 0; i < 60; i++) {
    days.push(toDateStr(start))
    start.setDate(start.getDate() + 1)
  }

  const activeDays = days.filter((d) => countMap.has(d))
  const displayDays = [...new Set([...activeDays, ...days.slice(0, 14)])]
    .sort()
    .slice(0, 30)

  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Timeline
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {selectedDate && (
          <button
            onClick={() => onSelectDate(null)}
            className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-lg border text-xs font-medium transition-all"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-text-on-primary)',
              borderColor: 'var(--color-accent)',
            }}
          >
            Clear
          </button>
        )}
        {displayDays.map((d) => {
          const count = countMap.get(d) ?? 0
          const isToday = d === today
          const isSelected = d === selectedDate
          const [, mm, dd] = d.split('-')

          return (
            <button
              key={d}
              onClick={() => onSelectDate(isSelected ? null : d)}
              className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.03]"
              style={{
                minWidth: '52px',
                background: isSelected
                  ? 'var(--color-primary)'
                  : isToday
                    ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                    : 'var(--color-glass-bg)',
                color: isSelected ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                borderColor: isSelected
                  ? 'var(--color-primary)'
                  : isToday
                    ? 'var(--color-primary)'
                    : 'var(--color-glass-border)',
                transitionDuration: 'var(--transition-speed)',
              }}
            >
              <span style={{ opacity: 0.7, fontSize: '10px' }}>{mm}/{dd}</span>
              <span className="text-base font-bold leading-none mt-0.5">
                {count > 0 ? count : '·'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
