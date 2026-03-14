'use client'

import type { BookingDetailReservation } from '../../../convex/bookings'
import { GlassBadge } from '@/components/glass'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReservationStatusListProps {
  reservations: BookingDetailReservation[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function reservationVariant(
  status: BookingDetailReservation['status'],
): 'success' | 'warning' | 'destructive' | 'default' {
  switch (status) {
    case 'Confirmed':
      return 'success'
    case 'PendingAcceptance':
      return 'warning'
    case 'Vacated':
    case 'NoShow':
      return 'destructive'
    default:
      return 'default'
  }
}

function statusLabel(status: BookingDetailReservation['status']): string {
  switch (status) {
    case 'PendingAcceptance':
      return 'Pending'
    default:
      return status
  }
}

function resourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Instructor: 'Instructor',
    DiveMaster: 'Divemaster',
    Boat: 'Boat',
    Equipment: 'Equipment',
    Pool: 'Pool',
    Compressor: 'Compressor',
  }
  return labels[type] ?? type
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReservationStatusList({ reservations }: ReservationStatusListProps) {
  if (reservations.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No resources assigned.
      </p>
    )
  }

  // Deduplicate by inventoryUnitId — one row per resource (multiple sessions share one reservation)
  const seen = new Set<string>()
  const unique = reservations.filter((r) => {
    if (seen.has(r.inventoryUnitId)) return false
    seen.add(r.inventoryUnitId)
    return true
  })

  return (
    <ul className="space-y-2">
      {unique.map((res) => (
        <li
          key={res._id}
          className="flex items-center justify-between gap-3 p-3 rounded-lg border"
          style={{
            background: 'var(--color-glass-bg)',
            borderColor: 'var(--color-glass-border)',
          }}
        >
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {res.inventoryUnitName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {resourceTypeLabel(res.resourceType)}
            </p>
          </div>
          <GlassBadge variant={reservationVariant(res.status)} size="sm" dot>
            {statusLabel(res.status)}
          </GlassBadge>
        </li>
      ))}
    </ul>
  )
}
