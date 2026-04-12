import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  assertBookingTransition,
  assertReservationTransition,
  assertBagTransition,
} from './fsm'
import { BOOKING_STATUS, RESERVATION_STATUS, BAG_STATUS } from '../shared/statuses'

describe('assertBookingTransition', () => {
  it('passes for valid transitions', () => {
    expect(() => assertBookingTransition(BOOKING_STATUS.Draft, 'confirm')).not.toThrow()
    expect(() => assertBookingTransition(BOOKING_STATUS.Upcoming, 'edit')).not.toThrow()
    expect(() => assertBookingTransition(BOOKING_STATUS.Completed, 'archive')).not.toThrow()
  })

  it('throws INVALID_STATUS for invalid transitions', () => {
    expect(() => assertBookingTransition(BOOKING_STATUS.Cancelled, 'edit')).toThrow(ConvexError)
    expect(() => assertBookingTransition(BOOKING_STATUS.Draft, 'archive')).toThrow(ConvexError)
    expect(() => assertBookingTransition(BOOKING_STATUS.Completed, 'edit')).toThrow(ConvexError)
  })
})

describe('assertReservationTransition', () => {
  it('passes for valid transitions', () => {
    expect(() => assertReservationTransition(RESERVATION_STATUS.PendingAcceptance, 'accept')).not.toThrow()
    expect(() => assertReservationTransition(RESERVATION_STATUS.Confirmed, 'vacate')).not.toThrow()
    expect(() => assertReservationTransition(RESERVATION_STATUS.Confirmed, 'mark_noshow')).not.toThrow()
    expect(() => assertReservationTransition(RESERVATION_STATUS.NoShow, 'revert_noshow')).not.toThrow()
  })

  it('throws INVALID_STATUS for invalid transitions', () => {
    expect(() => assertReservationTransition(RESERVATION_STATUS.Vacated, 'accept')).toThrow(ConvexError)
    expect(() => assertReservationTransition(RESERVATION_STATUS.PendingAcceptance, 'mark_noshow')).toThrow(ConvexError)
  })
})

describe('assertBagTransition', () => {
  it('passes for the linear lifecycle', () => {
    expect(() => assertBagTransition(BAG_STATUS.Assigned, 'pick_up')).not.toThrow()
    expect(() => assertBagTransition(BAG_STATUS.InUse, 'return')).not.toThrow()
  })

  it('throws for out-of-order or terminal transitions', () => {
    expect(() => assertBagTransition(BAG_STATUS.Assigned, 'return')).toThrow(ConvexError)
    expect(() => assertBagTransition(BAG_STATUS.InUse, 'pick_up')).toThrow(ConvexError)
    expect(() => assertBagTransition(BAG_STATUS.Returned, 'pick_up')).toThrow(ConvexError)
    expect(() => assertBagTransition(BAG_STATUS.Returned, 'return')).toThrow(ConvexError)
  })
})
