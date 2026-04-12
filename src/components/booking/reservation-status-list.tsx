import { useMemo } from 'react'
import type { BookingDetailReservation } from '../../../convex/bookings'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { reservationVariant } from '@/lib/booking/booking-display'
import {
  ResourceStatusList,
  type ResourceStatusItem,
} from './resource-status-list'

interface ReservationStatusListProps {
  reservations: BookingDetailReservation[]
}

function statusLabel(status: BookingDetailReservation['status']): string {
  switch (status) {
    case 'PendingAcceptance':
      return 'Pending'
    default:
      return status
  }
}

export function ReservationStatusList({
  reservations,
}: ReservationStatusListProps) {
  const items: ResourceStatusItem[] = useMemo(
    () =>
      reservations.map((res) => {
        const roleLabel =
          ROLE_BY_CLERK_ROLE[res.resourceType as ClerkRole]?.label ??
          res.resourceType
        const secondary = res.stakeholderName
          ? `${roleLabel} · ${res.stakeholderName}`
          : roleLabel
        return {
          id: res._id,
          primaryText: res.inventoryUnitName,
          secondaryText: secondary,
          badge: {
            variant: reservationVariant(res.status),
            label: statusLabel(res.status),
            dot: true,
          },
          destructiveNote: res.vacatedBy
            ? `Reason: ${res.vacatedBy.replace(/_/g, ' ')}`
            : undefined,
        }
      }),
    [reservations],
  )

  return (
    <ResourceStatusList
      items={items}
      emptyMessageKey="emptyStates.noResourcesAssigned"
      namespace="booking"
      variant="list"
      dedupeBy={(item) =>
        reservations.find((r) => r._id === item.id)?.inventoryUnitId ?? item.id
      }
    />
  )
}
