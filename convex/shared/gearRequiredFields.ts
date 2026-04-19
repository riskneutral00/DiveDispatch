import type { GearType } from './gearSizing'

export const GEAR_REQUIRED_FIELDS: Record<GearType, ReadonlyArray<'manufacturer' | 'size' | 'sizeSystem' | 'totalUnits'>> = {
  wetsuit: ['manufacturer', 'size', 'totalUnits'],
  bcd: ['manufacturer', 'size', 'totalUnits'],
  fins: ['manufacturer', 'size', 'sizeSystem', 'totalUnits'],
  mask: ['manufacturer', 'totalUnits'],
  regulator: ['manufacturer', 'totalUnits'],
}

export interface GearItemShape {
  manufacturer?: string
  size?: string
  sizeSystem?: string
  totalUnits?: number
  isPrescription?: boolean
  diopter?: number
}

export function isGearItemComplete(item: GearItemShape, gearType: GearType): boolean {
  for (const field of GEAR_REQUIRED_FIELDS[gearType]) {
    if (field === 'manufacturer' && !item.manufacturer?.trim()) return false
    if (field === 'size' && !item.size?.trim()) return false
    if (field === 'sizeSystem' && !item.sizeSystem?.trim()) return false
    if (field === 'totalUnits' && (typeof item.totalUnits !== 'number' || item.totalUnits < 1)) return false
  }
  if (gearType === 'mask' && item.isPrescription && typeof item.diopter !== 'number') return false
  return true
}
