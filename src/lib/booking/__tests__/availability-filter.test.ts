import { describe, expect, it } from 'vitest'
import { filterByAvailability, type CapacityData } from '@/lib/booking/availability-filter'

const OPTIONS = [
  { id: 'inst-1', label: 'Alice', languages: ['en-GB'] },
  { id: 'inst-2', label: 'Bob', languages: ['th-TH'] },
  { id: 'inst-3', label: 'Charlie', languages: ['en-GB'] },
]

const INVENTORY_MAP: Record<string, string> = {
  'inst-1': 'unit-1',
  'inst-2': 'unit-2',
}

describe('filterByAvailability', () => {
  it('returns all options when capacityData is undefined', () => {
    const result = filterByAvailability(OPTIONS, '2026-03-29', undefined, INVENTORY_MAP)
    expect(result).toHaveLength(3)
  })

  it('hides fully-booked resources', () => {
    const capacity: CapacityData = {
      'unit-1': { '2026-03-29': { available: 0, total: 1 } },
      'unit-2': { '2026-03-29': { available: 1, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, INVENTORY_MAP)
    expect(result.map((o) => o.id)).toEqual(['inst-2', 'inst-3'])
  })

  it('shows resources with no inventory unit mapping', () => {
    const capacity: CapacityData = {
      'unit-1': { '2026-03-29': { available: 0, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, INVENTORY_MAP)
    expect(result.map((o) => o.id)).toContain('inst-3')
  })

  it('shows resources with no capacity data for requested date', () => {
    const capacity: CapacityData = {
      'unit-1': { '2026-03-30': { available: 0, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, INVENTORY_MAP)
    expect(result).toHaveLength(3)
  })

  it('shows resources when available is greater than zero', () => {
    const capacity: CapacityData = {
      'unit-1': { '2026-03-29': { available: 1, total: 2 } },
      'unit-2': { '2026-03-29': { available: 1, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, INVENTORY_MAP)
    expect(result).toHaveLength(3)
  })

  it('handles empty options array', () => {
    expect(filterByAvailability([], '2026-03-29', undefined, {})).toEqual([])
  })

  it('handles empty inventory map', () => {
    const capacity: CapacityData = {
      'unit-1': { '2026-03-29': { available: 0, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, {})
    expect(result).toHaveLength(3)
  })

  it('preserves original order of options', () => {
    const capacity: CapacityData = {
      'unit-2': { '2026-03-29': { available: 1, total: 1 } },
    }
    const result = filterByAvailability(OPTIONS, '2026-03-29', capacity, INVENTORY_MAP)
    const ids = result.map((o) => o.id)
    for (let i = 0; i < ids.length - 1; i++) {
      const idxA = OPTIONS.findIndex((o) => o.id === ids[i])
      const idxB = OPTIONS.findIndex((o) => o.id === ids[i + 1])
      expect(idxA).toBeLessThan(idxB)
    }
  })

  it('does not mutate input arrays', () => {
    const optionsCopy = [...OPTIONS]
    filterByAvailability(OPTIONS, '2026-03-29', undefined, INVENTORY_MAP)
    expect(OPTIONS).toEqual(optionsCopy)
  })
})
