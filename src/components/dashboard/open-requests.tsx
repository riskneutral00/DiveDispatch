'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Clock, Users, Calendar } from 'lucide-react'
import { GlassCard, GlassBadge } from '@/components/glass'
import { RequestActions } from './request-actions'

interface OpenRequestsProps {
  confirmOnDecline?: boolean
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function OpenRequests({ confirmOnDecline = false }: OpenRequestsProps) {
  const requests = useQuery(api.resourceQueries.getOpenRequests)

  if (requests === undefined) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Loading requests…
        </p>
      </GlassCard>
    )
  }

  if (requests.length === 0) {
    return (
      <GlassCard padding="md">
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No pending requests.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <GlassCard key={req.reservationId} padding="md" hoverable>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Activity type badges */}
              <div className="flex flex-wrap gap-1">
                {req.activityType.map((a) => (
                  <GlassBadge key={a} variant="info" size="sm">
                    {a}
                  </GlassBadge>
                ))}
              </div>

              {/* Key info row */}
              <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {req.startDate}
                  {req.endDate !== req.startDate && ` → ${req.endDate}`}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {req.diverCount} diver{req.diverCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {timeAgo(req.createdAt)}
                </span>
              </div>

              {/* Operator name */}
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                From: {req.operatorName}
              </p>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              <RequestActions
                reservationId={req.reservationId}
                bookingId={req.bookingId}
                inventoryUnitId={req.inventoryUnitId}
                confirmOnDecline={confirmOnDecline}
              />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
