import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type DayConfig,
  type DiveSlot,
} from '../../src/lib/booking/wizard-state'

const DAY_BASE: DayConfig = {
  date: '2026-04-01',
  dives: [],
  divesPerDay: 2,
  startTime: '08:00',
  endTime: '16:00',
  timezone: 'Asia/Bangkok',
}

function stateWithDays(days: DayConfig[]): WizardState {
  return { ...makeInitialState(), days }
}

function stateWithCustomers(
  customers: WizardState['customers'],
): WizardState {
  return { ...makeInitialState(), customers }
}

describe('MARK_CUSTOMER_LINK_SENT', () => {
  it('marks the target customer as linkSent', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice' },
      { id: 'c2', name: 'Bob' },
    ])
    const next = wizardReducer(state, { type: 'MARK_CUSTOMER_LINK_SENT', customerId: 'c1' })
    expect(next.customers[0].linkSent).toBe(true)
    expect(next.customers[1].linkSent).toBeUndefined()
  })

  it('does not mutate other customers', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', linkSent: true },
      { id: 'c2', name: 'Bob' },
    ])
    const next = wizardReducer(state, { type: 'MARK_CUSTOMER_LINK_SENT', customerId: 'c2' })
    expect(next.customers[0].linkSent).toBe(true)
    expect(next.customers[1].linkSent).toBe(true)
  })
})

describe('SET_DIVE_VENUE', () => {
  it('updates venueType and resourceSlug on the target dive', () => {
    const dive: DiveSlot = { courseCode: 'OW', diveNumber: 1, isConfined: false }
    const state = stateWithDays([{ ...DAY_BASE, dives: [dive] }])
    const next = wizardReducer(state, {
      type: 'SET_DIVE_VENUE',
      dayIndex: 0,
      diveIndex: 0,
      venueType: 'boat',
      resourceSlug: 'boat-1',
    })
    expect(next.days[0].dives[0].venueType).toBe('boat')
    expect(next.days[0].dives[0].resourceSlug).toBe('boat-1')
  })

  it('returns state unchanged for invalid dayIndex', () => {
    const state = stateWithDays([{ ...DAY_BASE, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] }])
    const next = wizardReducer(state, {
      type: 'SET_DIVE_VENUE',
      dayIndex: 5,
      diveIndex: 0,
      venueType: 'pool',
    })
    expect(next).toEqual(state)
  })

  it('returns state unchanged for invalid diveIndex', () => {
    const state = stateWithDays([{ ...DAY_BASE, dives: [{ courseCode: 'OW', diveNumber: 1, isConfined: false }] }])
    const next = wizardReducer(state, {
      type: 'SET_DIVE_VENUE',
      dayIndex: 0,
      diveIndex: 5,
      venueType: 'shore',
    })
    expect(next).toEqual(state)
  })

  it('does not affect dives on other days', () => {
    const dive1: DiveSlot = { courseCode: 'OW', diveNumber: 1, isConfined: false }
    const dive2: DiveSlot = { courseCode: 'OW', diveNumber: 2, isConfined: false }
    const state = stateWithDays([
      { ...DAY_BASE, dives: [dive1] },
      { ...DAY_BASE, date: '2026-04-02', dives: [dive2] },
    ])
    const next = wizardReducer(state, {
      type: 'SET_DIVE_VENUE',
      dayIndex: 0,
      diveIndex: 0,
      venueType: 'pool',
      resourceSlug: 'pool-1',
    })
    expect(next.days[1].dives[0].venueType).toBeUndefined()
    expect(next.days[1].dives[0].resourceSlug).toBeUndefined()
  })
})

describe('SET_INVENTORY_MAP', () => {
  it('sets inventoryUnitMap on state', () => {
    const state = makeInitialState()
    const map = { 'jane-instructor': 'inv_123', 'big-boat': 'inv_456' }
    const next = wizardReducer(state, { type: 'SET_INVENTORY_MAP', map })
    expect(next.inventoryUnitMap).toEqual(map)
  })

  it('replaces existing map', () => {
    const state = { ...makeInitialState(), inventoryUnitMap: { old: 'val' } }
    const next = wizardReducer(state, { type: 'SET_INVENTORY_MAP', map: { new: 'val2' } })
    expect(next.inventoryUnitMap).toEqual({ new: 'val2' })
    expect(next.inventoryUnitMap).not.toHaveProperty('old')
  })
})

describe('SET_EQUIPMENT_EXTERNAL / SET_COMPRESSOR_EXTERNAL', () => {
  it('SET_EQUIPMENT_EXTERNAL sets equipmentIsExternal', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_EQUIPMENT_EXTERNAL', value: true })
    expect(next.equipmentIsExternal).toBe(true)
  })

  it('SET_COMPRESSOR_EXTERNAL sets compressorIsExternal', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_COMPRESSOR_EXTERNAL', value: true })
    expect(next.compressorIsExternal).toBe(true)
  })

  it('SET_EXTERNAL_EQUIPMENT_NAME sets externalEquipmentName', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_EXTERNAL_EQUIPMENT_NAME', value: 'Siam Gear' })
    expect(next.externalEquipmentName).toBe('Siam Gear')
  })

  it('SET_EXTERNAL_COMPRESSOR_NAME sets externalCompressorName', () => {
    const state = makeInitialState()
    const next = wizardReducer(state, { type: 'SET_EXTERNAL_COMPRESSOR_NAME', value: 'Koh Tao Fill' })
    expect(next.externalCompressorName).toBe('Koh Tao Fill')
  })
})

describe('TOGGLE_DIVE', () => {
  const slot: DiveSlot = { courseCode: 'OW', diveNumber: 1, isConfined: true }

  it('adds a dive slot when not present', () => {
    const state = stateWithDays([{ ...DAY_BASE, dives: [] }])
    const next = wizardReducer(state, { type: 'TOGGLE_DIVE', dayIndex: 0, slot })
    expect(next.days[0].dives).toHaveLength(1)
    expect(next.days[0].dives[0]).toEqual(slot)
  })

  it('removes a dive slot when already present', () => {
    const state = stateWithDays([{ ...DAY_BASE, dives: [slot] }])
    const next = wizardReducer(state, { type: 'TOGGLE_DIVE', dayIndex: 0, slot })
    expect(next.days[0].dives).toHaveLength(0)
  })

  it('matches on courseCode + diveNumber + isConfined (not venueType)', () => {
    const existing = { ...slot, venueType: 'pool' as const }
    const state = stateWithDays([{ ...DAY_BASE, dives: [existing] }])
    const next = wizardReducer(state, { type: 'TOGGLE_DIVE', dayIndex: 0, slot })
    expect(next.days[0].dives).toHaveLength(0)
  })

  it('returns state unchanged for invalid dayIndex', () => {
    const state = stateWithDays([{ ...DAY_BASE, dives: [] }])
    const next = wizardReducer(state, { type: 'TOGGLE_DIVE', dayIndex: 5, slot })
    expect(next).toEqual(state)
  })
})

describe('REMOVE_DAY', () => {
  it('removes a day by index', () => {
    const state = stateWithDays([
      { ...DAY_BASE, date: '2026-04-01' },
      { ...DAY_BASE, date: '2026-04-02' },
      { ...DAY_BASE, date: '2026-04-03' },
    ])
    const next = wizardReducer(state, { type: 'REMOVE_DAY', dayIndex: 1 })
    expect(next.days).toHaveLength(2)
    expect(next.days[0].date).toBe('2026-04-01')
    expect(next.days[1].date).toBe('2026-04-03')
  })

  it('does not remove the last remaining day', () => {
    const state = stateWithDays([{ ...DAY_BASE }])
    const next = wizardReducer(state, { type: 'REMOVE_DAY', dayIndex: 0 })
    expect(next.days).toHaveLength(1)
  })
})

describe('RESET', () => {
  it('resets to initial state with no payload', () => {
    const dirty = { ...makeInitialState(), equipment: 'eq-1', compressor: 'comp-1', step: 'review' as const }
    const next = wizardReducer(dirty, { type: 'RESET' })
    expect(next.equipment).toBe('')
    expect(next.compressor).toBe('')
    expect(next.step).toBe('customers')
  })

  it('resets with partial payload override', () => {
    const dirty = { ...makeInitialState(), equipment: 'eq-1' }
    const next = wizardReducer(dirty, { type: 'RESET', payload: { step: 'itinerary' } })
    expect(next.step).toBe('itinerary')
    expect(next.equipment).toBe('')
  })
})
