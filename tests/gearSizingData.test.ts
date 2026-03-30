import { describe, it, expect } from 'vitest'
import {
  ALL_GEAR_SIZING,
  MANUFACTURERS,
  GEAR_TYPES,
  SCUBAPRO_WETSUITS,
  SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS,
  AQUALUNG_BCDS,
  MARES_WETSUITS,
  MARES_BCDS,
  type GearSizingEntry,
} from '../convex/shared/gearSizing'

describe('GEAR_TYPES', () => {
  it('includes all 5 gear types', () => {
    expect(GEAR_TYPES).toContain('wetsuit')
    expect(GEAR_TYPES).toContain('bcd')
    expect(GEAR_TYPES).toContain('fins')
    expect(GEAR_TYPES).toContain('mask')
    expect(GEAR_TYPES).toContain('regulator')
    expect(GEAR_TYPES).toHaveLength(5)
  })
})

describe('MANUFACTURERS', () => {
  it('includes all 3 manufacturers', () => {
    expect(MANUFACTURERS).toContain('ScubaPro')
    expect(MANUFACTURERS).toContain('Aqua Lung')
    expect(MANUFACTURERS).toContain('Mares')
    expect(MANUFACTURERS).toHaveLength(3)
  })
})

describe('ALL_GEAR_SIZING', () => {
  it('aggregates all manufacturer arrays', () => {
    const expected =
      SCUBAPRO_WETSUITS.length +
      SCUBAPRO_BCDS.length +
      AQUALUNG_WETSUITS.length +
      AQUALUNG_BCDS.length +
      MARES_WETSUITS.length +
      MARES_BCDS.length
    expect(ALL_GEAR_SIZING).toHaveLength(expected)
  })

  it('all entries have positive minHeight and minWeight', () => {
    for (const entry of ALL_GEAR_SIZING) {
      expect(entry.minHeight).toBeGreaterThan(0)
      expect(entry.minWeight).toBeGreaterThan(0)
    }
  })

  it('maxHeight >= minHeight for all entries', () => {
    for (const entry of ALL_GEAR_SIZING) {
      expect(entry.maxHeight).toBeGreaterThanOrEqual(entry.minHeight)
    }
  })

  it('maxWeight >= minWeight for all entries', () => {
    for (const entry of ALL_GEAR_SIZING) {
      expect(entry.maxWeight).toBeGreaterThanOrEqual(entry.minWeight)
    }
  })

  it('all entries have non-empty size and manufacturer', () => {
    for (const entry of ALL_GEAR_SIZING) {
      expect(entry.size.length).toBeGreaterThan(0)
      expect(entry.manufacturer.length).toBeGreaterThan(0)
    }
  })

  it('all entries have gearType wetsuit or bcd', () => {
    for (const entry of ALL_GEAR_SIZING) {
      expect(['wetsuit', 'bcd']).toContain(entry.gearType)
    }
  })

  it('each manufacturer has both wetsuit and bcd entries', () => {
    for (const mfr of MANUFACTURERS) {
      const types = new Set(ALL_GEAR_SIZING.filter((e) => e.manufacturer === mfr).map((e) => e.gearType))
      expect(types.has('wetsuit')).toBe(true)
      expect(types.has('bcd')).toBe(true)
    }
  })

  it('sizes are unique per manufacturer+gearType', () => {
    const grouped: Record<string, string[]> = {}
    for (const entry of ALL_GEAR_SIZING) {
      const key = `${entry.manufacturer}:${entry.gearType}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(entry.size)
    }
    for (const [, sizes] of Object.entries(grouped)) {
      expect(new Set(sizes).size).toBe(sizes.length)
    }
  })
})

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

  it('entries are ordered by ascending minHeight', () => {
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].minHeight).toBeGreaterThanOrEqual(entries[i - 1].minHeight)
    }
  })

  it('height ranges overlap (no gaps in coverage)', () => {
    for (let i = 1; i < entries.length; i++) {
      expect(
        entries[i].minHeight,
        `gap between ${entries[i - 1].size} and ${entries[i].size}`,
      ).toBeLessThanOrEqual(entries[i - 1].maxHeight)
    }
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
