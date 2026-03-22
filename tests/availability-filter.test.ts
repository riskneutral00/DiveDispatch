import { describe, it, expect } from 'vitest'
import { filterByAvailability, type CapacityData } from '../src/lib/booking/availability-filter'

const DATE = '2026-04-01'

function opt(id: string, label: string) {
  return { id, label }
}

describe('filterByAvailability', () => {
  it('capacity undefined → returns all options (graceful degradation)', () => {
    const options = [opt('instr-a', 'Alice'), opt('instr-b', 'Bob')]
    const result = filterByAvailability(options, DATE, undefined, {})
    expect(result).toEqual(options)
  })

  it('instructor available → included', () => {
    const options = [opt('instr-a', 'Alice')]
    const capacity: CapacityData = { 'unit-a': { [DATE]: { available: 1, total: 1 } } }
    const inventoryMap = { 'instr-a': 'unit-a' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('instr-a')
  })

  it('instructor fully booked → excluded', () => {
    const options = [opt('instr-a', 'Alice')]
    const capacity: CapacityData = { 'unit-a': { [DATE]: { available: 0, total: 1 } } }
    const inventoryMap = { 'instr-a': 'unit-a' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(0)
  })

  it('boat partially booked → included (available > 0)', () => {
    const options = [opt('boat-a', 'Speedboat')]
    const capacity: CapacityData = { 'unit-b': { [DATE]: { available: 15, total: 20 } } }
    const inventoryMap = { 'boat-a': 'unit-b' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(1)
  })

  it('boat fully booked → excluded', () => {
    const options = [opt('boat-a', 'Speedboat')]
    const capacity: CapacityData = { 'unit-b': { [DATE]: { available: 0, total: 20 } } }
    const inventoryMap = { 'boat-a': 'unit-b' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(0)
  })

  it('option with no inventory unit → included (external resource)', () => {
    const options = [opt('unknown-slug', 'External Guy')]
    const capacity: CapacityData = {}
    const inventoryMap = {} // no mapping for this slug
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(1)
  })

  it('option with no capacity data for date → included (assume available)', () => {
    const options = [opt('instr-a', 'Alice')]
    const capacity: CapacityData = { 'unit-a': { '2026-05-01': { available: 0, total: 1 } } } // different date
    const inventoryMap = { 'instr-a': 'unit-a' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(1)
  })

  it('mixed: one available, one booked → only available returned', () => {
    const options = [opt('instr-a', 'Alice'), opt('instr-b', 'Bob')]
    const capacity: CapacityData = {
      'unit-a': { [DATE]: { available: 1, total: 1 } },
      'unit-b': { [DATE]: { available: 0, total: 1 } },
    }
    const inventoryMap = { 'instr-a': 'unit-a', 'instr-b': 'unit-b' }
    const result = filterByAvailability(options, DATE, capacity, inventoryMap)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('instr-a')
  })
})
