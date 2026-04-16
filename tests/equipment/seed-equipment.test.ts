import { describe, it, expect } from 'vitest'
import { NICOLE_DC, PARKED_STAKEHOLDERS, type SeedInventoryLine } from '../../convex/seedData'
import {
  SCUBAPRO_WETSUITS, SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS, AQUALUNG_BCDS,
  MARES_WETSUITS, MARES_BCDS,
} from '../../convex/shared/gearSizing'

const overrides = NICOLE_DC.equipment!.inventoryOverrides!

describe('Nicole inventoryOverrides', () => {
  it('produces exactly 70 lines', () => {
    expect(overrides).toHaveLength(70)
  })

  it('has 21 wetsuit rows (ScubaPro 8 + Aqua Lung 7 + Mares 6)', () => {
    const wetsuits = overrides.filter((l) => l.gearType === 'wetsuit')
    expect(wetsuits).toHaveLength(21)

    const sp = wetsuits.filter((l) => l.manufacturer === 'ScubaPro')
    const al = wetsuits.filter((l) => l.manufacturer === 'Aqua Lung')
    const ma = wetsuits.filter((l) => l.manufacturer === 'Mares')
    expect(sp).toHaveLength(SCUBAPRO_WETSUITS.length)
    expect(al).toHaveLength(AQUALUNG_WETSUITS.length)
    expect(ma).toHaveLength(MARES_WETSUITS.length)
  })

  it('has 16 BCD rows (ScubaPro 5 + Aqua Lung 6 + Mares 5)', () => {
    const bcds = overrides.filter((l) => l.gearType === 'bcd')
    expect(bcds).toHaveLength(16)

    const sp = bcds.filter((l) => l.manufacturer === 'ScubaPro')
    const al = bcds.filter((l) => l.manufacturer === 'Aqua Lung')
    const ma = bcds.filter((l) => l.manufacturer === 'Mares')
    expect(sp).toHaveLength(SCUBAPRO_BCDS.length)
    expect(al).toHaveLength(AQUALUNG_BCDS.length)
    expect(ma).toHaveLength(MARES_BCDS.length)
  })

  it('all wetsuits have 5 units, all BCDs have 6 units', () => {
    for (const line of overrides.filter((l) => l.gearType === 'wetsuit')) {
      expect(line.totalUnits).toBe(5)
    }
    for (const line of overrides.filter((l) => l.gearType === 'bcd')) {
      expect(line.totalUnits).toBe(6)
    }
  })

  it('wetsuit sizes match the gearSizing arrays exactly', () => {
    const spSizes = overrides
      .filter((l) => l.gearType === 'wetsuit' && l.manufacturer === 'ScubaPro')
      .map((l) => l.size)
    expect(spSizes).toEqual(SCUBAPRO_WETSUITS.map((e) => e.size))

    const alSizes = overrides
      .filter((l) => l.gearType === 'wetsuit' && l.manufacturer === 'Aqua Lung')
      .map((l) => l.size)
    expect(alSizes).toEqual(AQUALUNG_WETSUITS.map((e) => e.size))

    const maSizes = overrides
      .filter((l) => l.gearType === 'wetsuit' && l.manufacturer === 'Mares')
      .map((l) => l.size)
    expect(maSizes).toEqual(MARES_WETSUITS.map((e) => e.size))
  })

  it('has 20 fin rows with EU half-sizes from 38 to 47.5', () => {
    const fins = overrides.filter((l) => l.gearType === 'fins')
    expect(fins).toHaveLength(20)

    const sizes = fins.map((l) => l.size)
    expect(sizes[0]).toBe('EU 38')
    expect(sizes[1]).toBe('EU 38.5')
    expect(sizes[sizes.length - 1]).toBe('EU 47.5')

    for (const fin of fins) {
      expect(fin.totalUnits).toBe(5)
      expect(fin.manufacturer).toBeUndefined()
    }
  })

  it('has 10 mask rows: 1 regular + 9 Rx (diopter -2.0 to -6.0, step 0.5)', () => {
    const masks = overrides.filter((l) => l.gearType === 'mask')
    expect(masks).toHaveLength(10)

    const regular = masks.filter((l) => !l.isPrescription)
    expect(regular).toHaveLength(1)
    expect(regular[0].totalUnits).toBe(10)

    const rx = masks.filter((l) => l.isPrescription)
    expect(rx).toHaveLength(9)
    expect(rx.map((l) => l.diopter).sort((a, b) => a! - b!)).toEqual([-6, -5.5, -5, -4.5, -4, -3.5, -3, -2.5, -2])
    for (const mask of rx) {
      expect(mask.totalUnits).toBe(2)
    }
  })

  it('has 3 regulator rows: ScubaPro, Aqua Lung, Mares (20 units each)', () => {
    const regs = overrides.filter((l) => l.gearType === 'regulator')
    expect(regs).toHaveLength(3)
    const manufacturers = regs.map((l) => l.manufacturer).sort()
    expect(manufacturers).toEqual(['Aqua Lung', 'Mares', 'ScubaPro'])
    for (const reg of regs) {
      expect(reg.totalUnits).toBe(20)
    }
  })
})

describe('Other EMs', () => {
  const otherEMs = PARKED_STAKEHOLDERS.filter(
    (s) => s.equipment?.manufacturersByGearType && s.user.slug !== NICOLE_DC.user.slug,
  )

  it('no other EM has inventoryOverrides', () => {
    for (const s of otherEMs) {
      expect(s.equipment!.inventoryOverrides).toBeUndefined()
    }
  })

  it('Nicole is the only EM with inventoryOverrides', () => {
    const withOverrides = PARKED_STAKEHOLDERS.filter((s) => s.equipment?.inventoryOverrides)
    expect(withOverrides).toHaveLength(1)
    expect(withOverrides[0].user.slug).toBe(NICOLE_DC.user.slug)
  })
})
