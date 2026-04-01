import { describe, it, expect } from 'vitest'
import { skylinePack, getMaxRows, type BookingSpan } from '../skyline-packer'
import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

function span(
  id: string,
  startCol: number,
  endCol: number,
  opts?: { continuation?: boolean; status?: CalendarDisplayStatus },
): BookingSpan {
  return {
    id,
    startCol,
    endCol,
    label: id,
    status: opts?.status ?? 'Upcoming',
    continuation: opts?.continuation,
  }
}

describe('skylinePack', () => {
  it('returns empty array for no bookings', () => {
    expect(skylinePack([])).toEqual([])
  })

  it('places a single span in row 0', () => {
    const result = skylinePack([span('solo', 0, 2)])
    expect(result).toHaveLength(1)
    expect(result[0].row).toBe(0)
  })

  it('places non-overlapping spans at row 0', () => {
    const packed = skylinePack([
      span('a', 0, 1),
      span('b', 3, 4),
      span('c', 6, 6),
    ])
    expect(packed.every((b) => b.row === 0)).toBe(true)
  })

  it('stacks overlapping spans vertically', () => {
    const packed = skylinePack([
      span('a', 0, 2),
      span('b', 1, 3),
    ])
    const a = packed.find((b) => b.id === 'a')!
    const b = packed.find((b) => b.id === 'b')!
    expect(a.row).toBe(0)
    expect(b.row).toBe(1)
  })

  it('wider spans get lower rows when starting at same column', () => {
    const packed = skylinePack([
      span('wide', 0, 4),
      span('narrow', 0, 1),
    ])
    const wide = packed.find((b) => b.id === 'wide')!
    const narrow = packed.find((b) => b.id === 'narrow')!
    expect(wide.row).toBe(0)
    expect(narrow.row).toBe(1)
  })

  it('pins continuation spans to row 0', () => {
    const packed = skylinePack([
      span('cont', 0, 3, { continuation: true }),
      span('regular', 0, 2),
    ])
    const cont = packed.find((b) => b.id === 'cont')!
    const regular = packed.find((b) => b.id === 'regular')!
    expect(cont.row).toBe(0)
    expect(regular.row).toBe(1)
  })

  it('week-wrap: continuation pinned to row 0 even with wider regular span', () => {
    const packed = skylinePack([
      span('cont', 0, 2, { continuation: true }),
      span('full-week', 0, 6),
    ])
    const cont = packed.find((b) => b.id === 'cont')!
    const fullWeek = packed.find((b) => b.id === 'full-week')!
    expect(cont.row).toBe(0)
    // full-week overlaps continuation columns, so it gets pushed up
    expect(fullWeek.row).toBe(1)
  })

  it('multiple continuations all get row 0 in non-overlapping columns', () => {
    const packed = skylinePack([
      span('c1', 0, 1, { continuation: true }),
      span('c2', 3, 5, { continuation: true }),
    ])
    expect(packed.every((b) => b.row === 0)).toBe(true)
  })

  it('regular bookings pack around continuation correctly', () => {
    const packed = skylinePack([
      span('cont', 0, 2, { continuation: true }),
      span('r1', 4, 6),
      span('r2', 1, 3),
    ])
    const cont = packed.find((b) => b.id === 'cont')!
    const r1 = packed.find((b) => b.id === 'r1')!
    const r2 = packed.find((b) => b.id === 'r2')!
    expect(cont.row).toBe(0)
    expect(r1.row).toBe(0) // no overlap with continuation
    expect(r2.row).toBe(1) // overlaps continuation cols
  })

  it('packs three spans: full-week plus two non-overlapping segments on row 1', () => {
    const packed = skylinePack([
      span('a', 0, 6),
      span('b', 0, 2),
      span('c', 3, 5),
    ])
    const rowB = packed.find((b) => b.id === 'b')!.row
    const rowC = packed.find((b) => b.id === 'c')!.row
    expect(rowB).toBe(rowC)
  })
})

describe('getMaxRows', () => {
  it('returns 0 for empty array', () => {
    expect(getMaxRows([])).toBe(0)
  })

  it('returns correct max for packed bookings', () => {
    const packed = skylinePack([
      span('a', 0, 2),
      span('b', 1, 3),
      span('c', 2, 4),
    ])
    expect(getMaxRows(packed)).toBe(3)
  })
})
