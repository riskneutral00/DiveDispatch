import { describe, it, expect } from 'vitest'
import {
  BOOKING_STATUS,
  RESERVATION_STATUS,
  BAG_STATUS,
  NOTIFICATION_TYPE,
  VACATED_REASON,
} from '../convex/shared/statuses'

describe('BOOKING_STATUS', () => {
  it('has exactly 4 statuses', () => {
    expect(Object.keys(BOOKING_STATUS)).toHaveLength(4)
  })

  it('keys match values', () => {
    for (const [key, val] of Object.entries(BOOKING_STATUS)) {
      expect(key).toBe(val)
    }
  })

  it('contains Draft, Upcoming, Completed, Cancelled', () => {
    expect(BOOKING_STATUS.Draft).toBe('Draft')
    expect(BOOKING_STATUS.Upcoming).toBe('Upcoming')
    expect(BOOKING_STATUS.Completed).toBe('Completed')
    expect(BOOKING_STATUS.Cancelled).toBe('Cancelled')
  })
})

describe('RESERVATION_STATUS', () => {
  it('has exactly 4 statuses', () => {
    expect(Object.keys(RESERVATION_STATUS)).toHaveLength(4)
  })

  it('contains PendingAcceptance, Confirmed, Vacated, NoShow', () => {
    expect(RESERVATION_STATUS.PendingAcceptance).toBe('PendingAcceptance')
    expect(RESERVATION_STATUS.Confirmed).toBe('Confirmed')
    expect(RESERVATION_STATUS.Vacated).toBe('Vacated')
    expect(RESERVATION_STATUS.NoShow).toBe('NoShow')
  })
})

describe('BAG_STATUS', () => {
  it('has exactly 3 statuses', () => {
    expect(Object.keys(BAG_STATUS)).toHaveLength(3)
  })

  it('contains Assigned, InUse, Returned', () => {
    expect(BAG_STATUS.Assigned).toBe('Assigned')
    expect(BAG_STATUS.InUse).toBe('InUse')
    expect(BAG_STATUS.Returned).toBe('Returned')
  })
})

describe('NOTIFICATION_TYPE', () => {
  it('has unique values', () => {
    const values = Object.values(NOTIFICATION_TYPE)
    expect(new Set(values).size).toBe(values.length)
  })

  it('all values are snake_case strings', () => {
    for (const val of Object.values(NOTIFICATION_TYPE)) {
      expect(val).toMatch(/^[a-z_]+$/)
    }
  })
})

describe('VACATED_REASON', () => {
  it('has unique values', () => {
    const values = Object.values(VACATED_REASON)
    expect(new Set(values).size).toBe(values.length)
  })

  it('includes key vacated reasons', () => {
    expect(VACATED_REASON.BookingCancelled).toBe('booking_cancelled')
    expect(VACATED_REASON.StakeholderDeclined).toBe('stakeholder_declined')
    expect(VACATED_REASON.HoldExpired).toBe('hold_expired')
  })

  it('has exactly 8 vacated reasons', () => {
    expect(Object.keys(VACATED_REASON)).toHaveLength(8)
  })

  it('all values are snake_case strings', () => {
    for (const val of Object.values(VACATED_REASON)) {
      expect(val).toMatch(/^[a-z_]+$/)
    }
  })

  it('includes OperatorEdit and NoshowReplacement', () => {
    expect(VACATED_REASON.OperatorEdit).toBe('operator_edit')
    expect(VACATED_REASON.NoshowReplacement).toBe('noshow_replacement')
  })
})

describe('NOTIFICATION_TYPE', () => {
  it('has exactly 13 types', () => {
    expect(Object.keys(NOTIFICATION_TYPE)).toHaveLength(13)
  })

  it('includes booking lifecycle types', () => {
    expect(NOTIFICATION_TYPE.BookingCancelled).toBe('booking_cancelled')
    expect(NOTIFICATION_TYPE.BookingUpdated).toBe('booking_updated')
  })

  it('includes medical types', () => {
    expect(NOTIFICATION_TYPE.MedicalHardBlock).toBe('medical_hard_block')
    expect(NOTIFICATION_TYPE.MedicalCleared).toBe('medical_cleared')
  })

  it('includes portal completion type', () => {
    expect(NOTIFICATION_TYPE.PortalComplete).toBe('portal_complete')
  })
})
