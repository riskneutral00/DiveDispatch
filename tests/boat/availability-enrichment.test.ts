import { describe, it, expect } from 'vitest'
import {
  enrichOptionsWithCapacity,
  filterByAvailability,
  type CapacityData,
} from '../../src/lib/booking/availability-filter'

const options = [
  { id: 'boat-a', label: 'MV Hug Ocean' },
  { id: 'boat-b', label: 'MV Reef Runner' },
  { id: 'boat-c', label: 'MV External' },
]

const inventoryMap: Record<string, string> = {
  'boat-a': 'unit-1',
  'boat-b': 'unit-2',
}

const capacityData: CapacityData = {
  'unit-1': {
    '2026-04-15': { available: 12, total: 50 },
    '2026-04-16': { available: 0, total: 50 },
  },
  'unit-2': {
    '2026-04-15': { available: 30, total: 30 },
  },
}

describe('enrichOptionsWithCapacity', () => {
  it('appends (booked/total) to labels when capacity data is available', () => {
    const result = enrichOptionsWithCapacity(options, '2026-04-15', capacityData, inventoryMap)
    expect(result[0].label).toBe('MV Hug Ocean (38/50)')
    expect(result[1].label).toBe('MV Reef Runner (0/30)')
  })

  it('falls back to original label when no inventory mapping exists', () => {
    const result = enrichOptionsWithCapacity(options, '2026-04-15', capacityData, inventoryMap)
    expect(result[2].label).toBe('MV External')
  })

  it('falls back to original label when no date data exists', () => {
    const result = enrichOptionsWithCapacity(options, '2026-04-20', capacityData, inventoryMap)
    expect(result[0].label).toBe('MV Hug Ocean')
    expect(result[1].label).toBe('MV Reef Runner')
  })

  it('returns original options when capacityData is undefined', () => {
    const result = enrichOptionsWithCapacity(options, '2026-04-15', undefined, inventoryMap)
    expect(result).toEqual(options)
  })

  it('preserves extra properties on options', () => {
    const withLang = [{ id: 'boat-a', label: 'MV Hug Ocean', languages: ['en'], isPreferred: true }]
    const result = enrichOptionsWithCapacity(withLang, '2026-04-15', capacityData, inventoryMap)
    expect(result[0].languages).toEqual(['en'])
    expect(result[0].isPreferred).toBe(true)
    expect(result[0].label).toBe('MV Hug Ocean (38/50)')
  })
})

describe('filterByAvailability', () => {
  it('removes fully-booked options', () => {
    const result = filterByAvailability(options, '2026-04-16', capacityData, inventoryMap)
    expect(result.map((o) => o.id)).toEqual(['boat-b', 'boat-c'])
  })

  it('keeps options with no inventory mapping', () => {
    const result = filterByAvailability(options, '2026-04-16', capacityData, inventoryMap)
    expect(result.find((o) => o.id === 'boat-c')).toBeTruthy()
  })

  it('keeps all options when capacityData is undefined', () => {
    const result = filterByAvailability(options, '2026-04-16', undefined, inventoryMap)
    expect(result).toHaveLength(3)
  })
})
