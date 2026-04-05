/**
 * Re-export facade for convex/shared/statuses.
 * Single source of truth for booking/reservation/bag/notification status types.
 */
export {
  type BookingStatus,
  BOOKING_STATUS,
  type ReservationStatus,
  RESERVATION_STATUS,
  type BagStatus,
  BAG_STATUS,
  type NotificationType,
  NOTIFICATION_TYPE,
  type VacatedReason,
  VACATED_REASON,
} from '../../../convex/shared/statuses'
