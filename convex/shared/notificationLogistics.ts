/**
 * Shared logistics payload type for booking_confirmed notifications.
 * Placed in shared/ so it can be imported by both core (autoAdvance)
 * and adapters (notifications) without violating the core → adapter boundary.
 */
export interface NotificationLogistics {
  pickupTime?: string
  pickupLocation?: string
  departureTime?: string
  departureLocation?: string
  boatName?: string
  meetingPoint?: string
}
