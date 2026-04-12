import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'
import {
  canBookingTransition,
  canReservationTransition,
  canBagTransition,
  type BookingAction,
  type ReservationAction,
  type BagAction,
} from '../bookings/stateMachine'
import type { BookingStatus, ReservationStatus, BagStatus } from '../shared/statuses'

export function assertBookingTransition(status: BookingStatus, action: BookingAction): void {
  if (!canBookingTransition(status, action)) {
    throw new ConvexError({
      code: ErrorCode.INVALID_STATUS,
      reason: `Cannot ${action} booking in status '${status}'`,
    })
  }
}

export function assertReservationTransition(status: ReservationStatus, action: ReservationAction): void {
  if (!canReservationTransition(status, action)) {
    throw new ConvexError({
      code: ErrorCode.INVALID_STATUS,
      reason: `Cannot ${action} reservation in status '${status}'`,
    })
  }
}

export function assertBagTransition(status: BagStatus, action: BagAction): void {
  if (!canBagTransition(status, action)) {
    throw new ConvexError({
      code: ErrorCode.INVALID_STATUS,
      reason: `Cannot ${action} bag in status '${status}'`,
    })
  }
}
