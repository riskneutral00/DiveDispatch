import { describe, it, expect } from 'vitest'
import {
  canBookingTransition,
  canReservationTransition,
  isActiveReservation,
  isFullDayResource,
} from '../convex/bookings/stateMachine'

describe('canBookingTransition', () => {
  // confirm: Draft only
  it('allows confirm from Draft', () => {
    expect(canBookingTransition('Draft', 'confirm')).toBe(true)
  })
  it('blocks confirm from Upcoming', () => {
    expect(canBookingTransition('Upcoming', 'confirm')).toBe(false)
  })
  it('blocks confirm from Completed', () => {
    expect(canBookingTransition('Completed', 'confirm')).toBe(false)
  })
  it('blocks confirm from Cancelled', () => {
    expect(canBookingTransition('Cancelled', 'confirm')).toBe(false)
  })

  // edit: Upcoming | Completed
  it('allows edit from Upcoming', () => {
    expect(canBookingTransition('Upcoming', 'edit')).toBe(true)
  })
  it('allows edit from Completed', () => {
    expect(canBookingTransition('Completed', 'edit')).toBe(true)
  })
  it('blocks edit from Draft', () => {
    expect(canBookingTransition('Draft', 'edit')).toBe(false)
  })
  it('blocks edit from Cancelled', () => {
    expect(canBookingTransition('Cancelled', 'edit')).toBe(false)
  })

  // cancel: Any non-Cancelled
  it('allows cancel from Draft', () => {
    expect(canBookingTransition('Draft', 'cancel')).toBe(true)
  })
  it('allows cancel from Upcoming', () => {
    expect(canBookingTransition('Upcoming', 'cancel')).toBe(true)
  })
  it('allows cancel from Completed', () => {
    expect(canBookingTransition('Completed', 'cancel')).toBe(true)
  })
  it('blocks cancel from Cancelled', () => {
    expect(canBookingTransition('Cancelled', 'cancel')).toBe(false)
  })

  // complete: Upcoming only
  it('allows complete from Upcoming', () => {
    expect(canBookingTransition('Upcoming', 'complete')).toBe(true)
  })
  it('blocks complete from Draft', () => {
    expect(canBookingTransition('Draft', 'complete')).toBe(false)
  })
  it('blocks complete from Completed', () => {
    expect(canBookingTransition('Completed', 'complete')).toBe(false)
  })
  it('blocks complete from Cancelled', () => {
    expect(canBookingTransition('Cancelled', 'complete')).toBe(false)
  })
})

describe('canReservationTransition', () => {
  // accept: PendingAcceptance only
  it('allows accept from PendingAcceptance', () => {
    expect(canReservationTransition('PendingAcceptance', 'accept')).toBe(true)
  })
  it('blocks accept from Confirmed', () => {
    expect(canReservationTransition('Confirmed', 'accept')).toBe(false)
  })
  it('blocks accept from Vacated', () => {
    expect(canReservationTransition('Vacated', 'accept')).toBe(false)
  })
  it('blocks accept from NoShow', () => {
    expect(canReservationTransition('NoShow', 'accept')).toBe(false)
  })

  // vacate: PendingAcceptance | Confirmed
  it('allows vacate from PendingAcceptance', () => {
    expect(canReservationTransition('PendingAcceptance', 'vacate')).toBe(true)
  })
  it('allows vacate from Confirmed', () => {
    expect(canReservationTransition('Confirmed', 'vacate')).toBe(true)
  })
  it('blocks vacate from Vacated', () => {
    expect(canReservationTransition('Vacated', 'vacate')).toBe(false)
  })
  it('blocks vacate from NoShow', () => {
    expect(canReservationTransition('NoShow', 'vacate')).toBe(false)
  })

  // mark_noshow: Confirmed only
  it('allows mark_noshow from Confirmed', () => {
    expect(canReservationTransition('Confirmed', 'mark_noshow')).toBe(true)
  })
  it('blocks mark_noshow from PendingAcceptance', () => {
    expect(canReservationTransition('PendingAcceptance', 'mark_noshow')).toBe(false)
  })

  // revert_noshow: NoShow only
  it('allows revert_noshow from NoShow', () => {
    expect(canReservationTransition('NoShow', 'revert_noshow')).toBe(true)
  })
  it('blocks revert_noshow from Confirmed', () => {
    expect(canReservationTransition('Confirmed', 'revert_noshow')).toBe(false)
  })
})

describe('isActiveReservation', () => {
  it('returns true for PendingAcceptance', () => {
    expect(isActiveReservation({ status: 'PendingAcceptance' })).toBe(true)
  })
  it('returns true for Confirmed', () => {
    expect(isActiveReservation({ status: 'Confirmed' })).toBe(true)
  })
  it('returns false for Vacated', () => {
    expect(isActiveReservation({ status: 'Vacated' })).toBe(false)
  })
  it('returns false for NoShow', () => {
    expect(isActiveReservation({ status: 'NoShow' })).toBe(false)
  })
})

describe('isFullDayResource', () => {
  it('returns true for day_boat', () => {
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'day_boat' })).toBe(true)
  })
  it('returns true for liveaboard', () => {
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'liveaboard' })).toBe(true)
  })
  it('returns false for speedboat', () => {
    expect(isFullDayResource({ resourceType: 'Boat', boatType: 'speedboat' })).toBe(false)
  })
  it('returns false for non-Boat resource', () => {
    expect(isFullDayResource({ resourceType: 'Instructor' })).toBe(false)
  })
  it('returns false for Boat with no boatType', () => {
    expect(isFullDayResource({ resourceType: 'Boat' })).toBe(false)
  })
})
