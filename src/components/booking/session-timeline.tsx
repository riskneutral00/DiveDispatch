import { useMemo } from 'react'
import { Calendar, Clock, MapPin } from 'lucide-react'
import type { BookingDetailSession } from '../../../convex/bookings'
import { EmptyState } from '@/components/ui'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionTimelineProps {
  sessions: BookingDetailSession[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function locationLabel(loc: BookingDetailSession['deliveryLocation']): string {
  switch (loc) {
    case 'BoatPier':
      return 'Boat / Pier'
    case 'Pool':
      return 'Pool'
    case 'Beach':
      return 'Shore'
    default:
      return '—'
  }
}

function groupByDate(sessions: BookingDetailSession[]): Map<string, BookingDetailSession[]> {
  const map = new Map<string, BookingDetailSession[]>()
  for (const s of sessions) {
    const list = map.get(s.date) ?? []
    list.push(s)
    map.set(s.date, list)
  }
  return map
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  if (sessions.length === 0) {
    return <EmptyState message="No sessions scheduled." />
  }

  const byDate = useMemo(() => groupByDate(sessions), [sessions])
  const sortedDates = useMemo(() => [...byDate.keys()].sort(), [byDate])

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => {
        const daySessions = byDate.get(date)!
        return (
          <div key={date}>
            {/* Date header */}
            <div
              className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide text-secondary"
            >
              <Calendar size={12} />
              <span>{date}</span>
            </div>

            {/* Sessions for this date */}
            <div className="space-y-2 pl-4 border-l-2 border-glass-border">
              {daySessions.map((s) => (
                <div
                  key={s._id}
                  className="relative pl-3"
                >
                  {/* Timeline dot */}
                  <span
                    className="absolute left-[-9px] top-2 w-3 h-3 rounded-full border-2 bg-glass-bg border-primary"
                  />

                  <div
                    className="p-3 rounded-theme border bg-glass-bg border-glass-border"
                  >
                    <p
                      className="text-sm font-medium text-primary"
                    >
                      {s.inventoryUnitName}
                    </p>
                    <div
                      className="flex items-center gap-3 mt-1 text-xs flex-wrap text-secondary"
                    >
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {s.startTime} – {s.endTime}
                      </span>
                      {s.deliveryLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {locationLabel(s.deliveryLocation)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
