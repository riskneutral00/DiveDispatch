import { describe, it, expect } from 'vitest'
import {
  SCUBAPRO_WETSUITS,
  SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS,
  AQUALUNG_BCDS,
  MARES_WETSUITS,
  MARES_BCDS,
  ALL_GEAR_SIZING,
  MANUFACTURERS,
  GEAR_TYPES,
  type GearSizingEntry,
} from '../../convex/shared/gearSizing'

// ── Per-manufacturer array structural checks ───────────────────────────────────

const manufacturerArrays: [string, GearSizingEntry[]][] = [
  ['ScubaPro wetsuits', SCUBAPRO_WETSUITS],
  ['ScubaPro BCDs', SCUBAPRO_BCDS],
  ['Aqua Lung wetsuits', AQUALUNG_WETSUITS],
  ['Aqua Lung BCDs', AQUALUNG_BCDS],
  ['Mares wetsuits', MARES_WETSUITS],
  ['Mares BCDs', MARES_BCDS],
]

describe.each(manufacturerArrays)('%s', (_name, entries) => {
  it('has at least 3 size entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(3)
  })

  it('all entries have non-empty size', () => {
    for (const e of entries) {
      expect(e.size.length).toBeGreaterThan(0)
    }
  })

  it('all entries have non-empty manufacturer', () => {
    for (const e of entries) {
      expect(e.manufacturer.length).toBeGreaterThan(0)
    }
  })

  it('all minHeight < maxHeight', () => {
    for (const e of entries) {
      expect(e.minHeight).toBeLessThan(e.maxHeight)
    }
  })

  it('all minWeight < maxWeight', () => {
    for (const e of entries) {
      expect(e.minWeight).toBeLessThan(e.maxWeight)
    }
  })

  it('all minHeight values are positive', () => {
    for (const e of entries) {
      expect(e.minHeight).toBeGreaterThan(0)
    }
  })

  it('all minWeight values are positive', () => {
    for (const e of entries) {
      expect(e.minWeight).toBeGreaterThan(0)
    }
  })

  it('sizes are unique within the array', () => {
    const sizes = entries.map((e) => e.size)
    expect(new Set(sizes).size).toBe(sizes.length)
  })

  it('entries are ordered by ascending minHeight', () => {
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].minHeight).toBeGreaterThanOrEqual(entries[i - 1].minHeight)
    }
  })

  it('height ranges overlap (no gaps in coverage)', () => {
    for (let i = 1; i < entries.length; i++) {
      // Next entry's minHeight should be <= previous entry's maxHeight
      expect(
        entries[i].minHeight,
        `gap between ${entries[i - 1].size} and ${entries[i].size}`,
      ).toBeLessThanOrEqual(entries[i - 1].maxHeight)
    }
  })
})

// ── ALL_GEAR_SIZING aggregate ──────────────────────────────────────────────────

describe('ALL_GEAR_SIZING', () => {
  it('is the union of all manufacturer arrays', () => {
    const expected =
      SCUBAPRO_WETSUITS.length +
      SCUBAPRO_BCDS.length +
      AQUALUNG_WETSUITS.length +
      AQUALUNG_BCDS.length +
      MARES_WETSUITS.length +
      MARES_BCDS.length
    expect(ALL_GEAR_SIZING.length).toBe(expected)
  })

  it('only contains wetsuit and bcd gearTypes', () => {
    const types = new Set(ALL_GEAR_SIZING.map((e) => e.gearType))
    expect(types).toEqual(new Set(['wetsuit', 'bcd']))
  })

  it('every manufacturer in the data is in MANUFACTURERS', () => {
    const dataManufacturers = new Set(ALL_GEAR_SIZING.map((e) => e.manufacturer))
    for (const m of dataManufacturers) {
      expect(MANUFACTURERS).toContain(m)
    }
  })

  it('every MANUFACTURERS entry has at least one sizing entry', () => {
    for (const m of MANUFACTURERS) {
      const count = ALL_GEAR_SIZING.filter((e) => e.manufacturer === m).length
      expect(count, `${m} has no sizing entries`).toBeGreaterThan(0)
    }
  })

  it('every manufacturer has both wetsuit and bcd entries', () => {
    for (const m of MANUFACTURERS) {
      const types = new Set(ALL_GEAR_SIZING.filter((e) => e.manufacturer === m).map((e) => e.gearType))
      expect(types.has('wetsuit'), `${m} missing wetsuit`).toBe(true)
      expect(types.has('bcd'), `${m} missing bcd`).toBe(true)
    }
  })
})

// ── MANUFACTURERS ──────────────────────────────────────────────────────────────

describe('MANUFACTURERS', () => {
  it('has exactly 3 entries', () => {
    expect(MANUFACTURERS.length).toBe(3)
  })

  it('contains known dive gear brands', () => {
    expect(MANUFACTURERS).toContain('ScubaPro')
    expect(MANUFACTURERS).toContain('Aqua Lung')
    expect(MANUFACTURERS).toContain('Mares')
  })
})

// ── GEAR_TYPES ─────────────────────────────────────────────────────────────────

describe('GEAR_TYPES', () => {
  it('contains wetsuit, bcd, fins, mask, regulator', () => {
    expect(GEAR_TYPES).toContain('wetsuit')
    expect(GEAR_TYPES).toContain('bcd')
    expect(GEAR_TYPES).toContain('fins')
    expect(GEAR_TYPES).toContain('mask')
    expect(GEAR_TYPES).toContain('regulator')
  })

  it('has no duplicates', () => {
    expect(new Set(GEAR_TYPES).size).toBe(GEAR_TYPES.length)
  })
})

// ── Physical plausibility ──────────────────────────────────────────────────────

describe('physical plausibility', () => {
  it('no wetsuit starts below 140cm height', () => {
    const wetsuits = ALL_GEAR_SIZING.filter((e) => e.gearType === 'wetsuit')
    for (const e of wetsuits) {
      expect(e.minHeight, `${e.manufacturer} ${e.size}`).toBeGreaterThanOrEqual(140)
    }
  })

  it('no BCD starts below 140cm height', () => {
    const bcds = ALL_GEAR_SIZING.filter((e) => e.gearType === 'bcd')
    for (const e of bcds) {
      expect(e.minHeight, `${e.manufacturer} ${e.size}`).toBeGreaterThanOrEqual(140)
    }
  })

  it('no entry has minWeight below 30kg (adult sizing)', () => {
    for (const e of ALL_GEAR_SIZING) {
      expect(e.minWeight, `${e.manufacturer} ${e.size}`).toBeGreaterThanOrEqual(30)
    }
  })

  it('largest size covers at least 190cm', () => {
    for (const m of MANUFACTURERS) {
      const wetsuits = ALL_GEAR_SIZING.filter((e) => e.manufacturer === m && e.gearType === 'wetsuit')
      const maxMaxHeight = Math.max(...wetsuits.map((e) => e.maxHeight))
      expect(maxMaxHeight, `${m} wetsuits`).toBeGreaterThanOrEqual(190)
    }
  })

  it('smallest size starts at or below 160cm', () => {
    for (const m of MANUFACTURERS) {
      const wetsuits = ALL_GEAR_SIZING.filter((e) => e.manufacturer === m && e.gearType === 'wetsuit')
      const minMinHeight = Math.min(...wetsuits.map((e) => e.minHeight))
      expect(minMinHeight, `${m} wetsuits`).toBeLessThanOrEqual(160)
    }
  })
})
