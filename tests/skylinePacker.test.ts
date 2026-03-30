import { describe, it, expect } from 'vitest'
import { skylinePack, getMaxRows, type BookingSpan } from '../src/lib/utils/skyline-packer'

function span(overrides: Partial<BookingSpan> & { startCol: number; endCol: number }): BookingSpan {
  return {
    id: overrides.id ?? `booking-${overrides.startCol}-${overrides.endCol}`,
    label: overrides.label ?? 'Test Booking',
    status: overrides.status ?? 'Draft',
    ...overrides,
  }
}

describe('skylinePack', () => {
  it('returns empty array for no bookings', () => {
    expect(skylinePack([])).toEqual([])
  })

  it('places a single booking in row 0', () => {
    const result = skylinePack([span({ startCol: 0, endCol: 2 })])
    expect(result).toHaveLength(1)
    expect(result[0].row).toBe(0)
  })

  it('stacks overlapping bookings on different rows', () => {
    const result = skylinePack([
      span({ id: 'a', startCol: 0, endCol: 2 }),
      span({ id: 'b', startCol: 1, endCol: 3 }),
    ])
    const rowA = result.find(b => b.id === 'a')!.row
    const rowB = result.find(b => b.id === 'b')!.row
    expect(rowA).not.toBe(rowB)
  })

  it('places non-overlapping bookings on the same row', () => {
    const result = skylinePack([
      span({ id: 'a', startCol: 0, endCol: 1 }),
      span({ id: 'b', startCol: 3, endCol: 4 }),
    ])
    const rowA = result.find(b => b.id === 'a')!.row
    const rowB = result.find(b => b.id === 'b')!.row
    expect(rowA).toBe(rowB)
  })

  it('pins continuations to row 0', () => {
    const result = skylinePack([
      span({ id: 'cont', startCol: 0, endCol: 2, continuation: true }),
      span({ id: 'regular', startCol: 0, endCol: 2 }),
    ])
    const cont = result.find(b => b.id === 'cont')!
    const regular = result.find(b => b.id === 'regular')!
    expect(cont.row).toBe(0)
    expect(regular.row).toBe(1) // pushed above continuation
  })

  it('packs three bookings efficiently', () => {
    const result = skylinePack([
      span({ id: 'a', startCol: 0, endCol: 6 }), // spans full week
      span({ id: 'b', startCol: 0, endCol: 2 }),
      span({ id: 'c', startCol: 3, endCol: 5 }),
    ])
    // a takes row 0 (sorted first: starts at 0, widest)
    // b and c don't overlap each other, so both on row 1
    const rowB = result.find(b => b.id === 'b')!.row
    const rowC = result.find(b => b.id === 'c')!.row
    expect(rowB).toBe(rowC)
  })

  it('sorts wider bookings first when starting at same column', () => {
    const result = skylinePack([
      span({ id: 'narrow', startCol: 0, endCol: 0 }),
      span({ id: 'wide', startCol: 0, endCol: 3 }),
    ])
    const wideRow = result.find(b => b.id === 'wide')!.row
    const narrowRow = result.find(b => b.id === 'narrow')!.row
    // Wide should be placed first (lower row), narrow stacked above
    expect(wideRow).toBeLessThan(narrowRow)
  })
})

describe('getMaxRows', () => {
  it('returns 0 for empty packed array', () => {
    expect(getMaxRows([])).toBe(0)
  })

  it('returns 1 for a single booking in row 0', () => {
    expect(getMaxRows([{ ...span({ startCol: 0, endCol: 2 }), row: 0 }])).toBe(1)
  })

  it('returns correct count for multi-row layout', () => {
    expect(getMaxRows([
      { ...span({ startCol: 0, endCol: 2 }), row: 0 },
      { ...span({ startCol: 0, endCol: 2 }), row: 1 },
      { ...span({ startCol: 0, endCol: 2 }), row: 2 },
    ])).toBe(3)
  })
})
