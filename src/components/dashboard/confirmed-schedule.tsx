'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Calendar, Clock, Users } from 'lucide-react'
import { GlassCard, GlassBadge } from '@/components/glass'

export function ConfirmedSchedule() {
  const schedule = useQuery(api.resourceQueries.getConfirmedSchedule)

  if (schedule === undefined) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Loading schedule…
        </p>
      </GlassCard>
    )
  }

  if (schedule.length === 0) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No confirmed bookings yet.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {schedule.map((item) => {
        const nextSession = item.sessions[0]
        return (
          <GlassCard key={item.reservationId} padding="md">
            <div className="space-y-2">
              {/* Activity + status */}
              <div className="flex flex-wrap items-center gap-2">
                {item.activityType.map((a) => (
                  <GlassBadge key={a} variant="info" size="sm">
                    {a}
                  </GlassBadge>
                ))}
                <GlassBadge variant="success" size="sm" dot>
                  Confirmed
                </GlassBadge>
              </div>

              {/* Date and session info */}
              <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {item.startDate}
                  {item.endDate !== item.startDate && ` → ${item.endDate}`}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {item.diverCount} diver{item.diverCount !== 1 ? 's' : ''}
                </span>
                {nextSession && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {nextSession.startTime} – {nextSession.endTime}
                  </span>
                )}
              </div>

              {/* Operator + session count */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.operatorName}
                </p>
                {item.sessions.length > 1 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.sessions.length} sessions
                  </p>
                )}
              </div>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}
