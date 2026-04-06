import type { BookingDetailReservation } from '../../../convex/bookings'
import { Badge, EmptyState, ListRow } from '@/components/ui'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { reservationVariant } from '@/lib/booking/booking-display'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReservationStatusListProps {
  reservations: BookingDetailReservation[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusLabel(status: BookingDetailReservation['status']): string {
  switch (status) {
    case 'PendingAcceptance':
      return 'Pending'
    default:
      return status
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReservationStatusList({ reservations }: ReservationStatusListProps) {
  if (reservations.length === 0) {
    return <EmptyState message="No resources assigned." />
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
        <ListRow key={res._id} as="li">
          <div className="min-w-0">
            <p className="text-body font-medium truncate text-primary">
              {res.inventoryUnitName}
            </p>
            <p className="text-label mt-0.5 text-secondary">
              {ROLE_BY_CLERK_ROLE[res.resourceType as ClerkRole]?.label ?? res.resourceType}
              {res.stakeholderName && (
                <> · <span className="text-secondary">{res.stakeholderName}</span></>
              )}
            </p>
            {res.vacatedBy && (
              <p className="text-label mt-0.5 text-destructive">
                Reason: {res.vacatedBy.replace(/_/g, ' ')}
              </p>
            )}
          </div>
          <Badge variant={reservationVariant(res.status)} size="sm" dot>
            {statusLabel(res.status)}
          </Badge>
        </ListRow>
      ))}
    </ul>
  )
}
