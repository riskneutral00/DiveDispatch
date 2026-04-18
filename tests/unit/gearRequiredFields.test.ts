import { describe, it, expect } from 'vitest'
import { isGearItemComplete } from '../../convex/shared/gearRequiredFields'

describe('isGearItemComplete', () => {
  it('wetsuit requires manufacturer + size + totalUnits', () => {
    expect(isGearItemComplete({}, 'wetsuit')).toBe(false)
    expect(isGearItemComplete({ manufacturer: 'ScubaPro' }, 'wetsuit')).toBe(false)
    expect(isGearItemComplete({ manufacturer: 'ScubaPro', size: 'M' }, 'wetsuit')).toBe(false)
    expect(isGearItemComplete({ manufacturer: 'ScubaPro', size: 'M', totalUnits: 1 }, 'wetsuit')).toBe(true)
  })

  it('rejects whitespace-only manufacturer or size', () => {
    expect(isGearItemComplete({ manufacturer: '   ', size: 'M', totalUnits: 1 }, 'wetsuit')).toBe(false)
    expect(isGearItemComplete({ manufacturer: 'ScubaPro', size: '  ', totalUnits: 1 }, 'wetsuit')).toBe(false)
  })

  it('regulator does not require size', () => {
    expect(isGearItemComplete({ manufacturer: 'Apeks', totalUnits: 3 }, 'regulator')).toBe(true)
    expect(isGearItemComplete({ manufacturer: 'Apeks' }, 'regulator')).toBe(false)
  })

  it('mask does not require size', () => {
    expect(isGearItemComplete({ manufacturer: 'Aqua Lung', totalUnits: 4 }, 'mask')).toBe(true)
    expect(isGearItemComplete({ manufacturer: 'Aqua Lung' }, 'mask')).toBe(false)
  })

  it('mask with isPrescription=true requires diopter', () => {
    const base = { manufacturer: 'Aqua Lung', totalUnits: 4 }
    expect(isGearItemComplete({ ...base, isPrescription: false }, 'mask')).toBe(true)
    expect(isGearItemComplete({ ...base, isPrescription: true }, 'mask')).toBe(false)
    expect(isGearItemComplete({ ...base, isPrescription: true, diopter: -2 }, 'mask')).toBe(true)
  })

  it('rejects zero or negative totalUnits', () => {
    expect(isGearItemComplete({ manufacturer: 'X', size: 'M', totalUnits: 0 }, 'wetsuit')).toBe(false)
    expect(isGearItemComplete({ manufacturer: 'X', size: 'M', totalUnits: -1 }, 'wetsuit')).toBe(false)
  })
})
