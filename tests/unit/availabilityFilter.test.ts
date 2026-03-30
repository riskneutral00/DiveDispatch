import { describe, it, expect } from 'vitest'
import { filterByAvailability, type CapacityData } from '../../src/lib/booking/availability-filter'

const options = [
  { id: 'inst-1', label: 'Alice' },
  { id: 'inst-2', label: 'Bob' },
  { id: 'inst-3', label: 'Charlie' },
]

const inventoryMap: Record<string, string> = {
  'inst-1': 'unit-a',
  'inst-2': 'unit-b',
  // inst-3 has no inventory unit (external)
}

describe('filterByAvailability', () => {
  it('returns all options when capacityData is undefined', () => {
    expect(filterByAvailability(options, '2026-04-01', undefined, inventoryMap)).toEqual(options)
  })

  it('hides fully-booked resources', () => {
    const capacity: CapacityData = {
      'unit-a': { '2026-04-01': { available: 0, total: 1 } },
      'unit-b': { '2026-04-01': { available: 1, total: 1 } },
    }
    const result = filterByAvailability(options, '2026-04-01', capacity, inventoryMap)
    expect(result.map((o) => o.id)).toEqual(['inst-2', 'inst-3'])
  })

  it('shows resources with no inventory unit (external)', () => {
    const capacity: CapacityData = {}
    const result = filterByAvailability(options, '2026-04-01', capacity, inventoryMap)
    expect(result).toEqual(options)
  })

  it('shows resources with no date-specific capacity data', () => {
    const capacity: CapacityData = {
      'unit-a': { '2026-04-02': { available: 0, total: 1 } },
    }
    const result = filterByAvailability(options, '2026-04-01', capacity, inventoryMap)
    expect(result).toEqual(options)
  })

  it('hides all resources when all are fully booked', () => {
    const capacity: CapacityData = {
      'unit-a': { '2026-04-01': { available: 0, total: 1 } },
      'unit-b': { '2026-04-01': { available: 0, total: 1 } },
    }
    const result = filterByAvailability(options, '2026-04-01', capacity, inventoryMap)
    // inst-3 still visible (no inventory unit)
    expect(result.map((o) => o.id)).toEqual(['inst-3'])
  })
})
