import { describe, it, expect } from 'vitest'
import {
  getDeliveryLocation,
  buildSessionsFromDays,
  buildDefaultDays,
} from '../../src/lib/booking/session-builder'
import type { DayConfig } from '../../src/lib/booking/wizard-state'

describe('getDeliveryLocation', () => {
  it('returns Pool for confined day regardless of venue', () => {
    expect(getDeliveryLocation(true, 'Boat')).toBe('Pool')
    expect(getDeliveryLocation(true, 'Shore')).toBe('Pool')
    expect(getDeliveryLocation(true)).toBe('Pool')
  })

  it('returns BoatPier for non-confined boat day', () => {
    expect(getDeliveryLocation(false, 'Boat')).toBe('BoatPier')
    expect(getDeliveryLocation(false)).toBe('BoatPier')
  })

  it('returns Beach for non-confined shore day', () => {
    expect(getDeliveryLocation(false, 'Shore')).toBe('Beach')
  })
})

describe('buildSessionsFromDays', () => {
  it('converts a pool day to a session with Pool delivery location', () => {
    const days: DayConfig[] = [{
      date: '2026-04-01',
      venueType: 'pool',
      dives: [{ courseCode: 'OW', diveNumber: 0, isConfined: true }],
      divesPerDay: 3,
      startTime: '09:00',
      endTime: '14:00',
      timezone: 'Asia/Bangkok',
    }]
    const sessions = buildSessionsFromDays(days, 2)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].deliveryLocation).toBe('Pool')
    expect(sessions[0].isConfinedDay).toBe(true)
    expect(sessions[0].resourceType).toBe('pool')
    expect(sessions[0].unitsRequested).toBe(2)
  })

  it('converts a boat day to a session with BoatPier delivery location', () => {
    const days: DayConfig[] = [{
      date: '2026-04-02',
      venueType: 'boat',
      dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }],
      divesPerDay: 3,
      startTime: '08:00',
      endTime: '17:00',
      timezone: 'Asia/Bangkok',
    }]
    const sessions = buildSessionsFromDays(days, 1)
    expect(sessions[0].deliveryLocation).toBe('BoatPier')
    expect(sessions[0].isConfinedDay).toBe(false)
    expect(sessions[0].resourceType).toBe('boat')
  })

  it('ensures unitsRequested is at least 1', () => {
    const days: DayConfig[] = [{
      date: '2026-04-01',
      venueType: 'boat',
      dives: [],
      divesPerDay: 3,
      startTime: '08:00',
      endTime: '17:00',
      timezone: 'Asia/Bangkok',
    }]
    const sessions = buildSessionsFromDays(days, 0)
    expect(sessions[0].unitsRequested).toBe(1)
  })
})

describe('buildDefaultDays', () => {
  it('returns empty for invalid date range', () => {
    expect(buildDefaultDays('2026-04-05', '2026-04-01', ['OW'])).toEqual([])
  })

  it('creates pool day first when course requires confined', () => {
    const days = buildDefaultDays('2026-04-01', '2026-04-03', ['OW'])
    expect(days[0].venueType).toBe('pool')
    expect(days[0].startTime).toBe('09:00')
    expect(days[1].venueType).toBe('boat')
    expect(days[1].startTime).toBe('08:00')
  })

  it('all days are boat for non-confined course (FD)', () => {
    const days = buildDefaultDays('2026-04-01', '2026-04-02', ['FD'])
    expect(days.every((d) => d.venueType === 'boat')).toBe(true)
  })

  it('generates one day per date in range', () => {
    const days = buildDefaultDays('2026-04-01', '2026-04-03', ['OW'])
    expect(days).toHaveLength(3)
    expect(days.map((d) => d.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })

  it('uses provided timezone', () => {
    const days = buildDefaultDays('2026-04-01', '2026-04-01', ['FD'], 'America/New_York')
    expect(days[0].timezone).toBe('America/New_York')
  })
})
