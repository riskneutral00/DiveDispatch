export interface GearSizingEntry {
  manufacturer: string;
  gearType: 'wetsuit' | 'bcd';
  size: string;
  minHeight: number; // cm
  maxHeight: number; // cm, Infinity for open-ended
  minWeight: number; // kg
  maxWeight: number; // kg, Infinity for open-ended
}

export interface FinSizingEntry {
  gearType: 'fins';
  size: string;
  minShoeSize: number; // EU
  maxShoeSize: number; // EU
}

export const SCUBAPRO_WETSUITS: GearSizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: '2XS', minHeight: 150, maxHeight: 155, minWeight: 42, maxWeight: 54 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'XS',  minHeight: 155, maxHeight: 170, minWeight: 47, maxWeight: 75 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'S',   minHeight: 160, maxHeight: 175, minWeight: 52, maxWeight: 80 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'M',   minHeight: 165, maxHeight: 180, minWeight: 57, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'L',   minHeight: 170, maxHeight: 185, minWeight: 60, maxWeight: 90 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: 'XL',  minHeight: 175, maxHeight: 190, minWeight: 65, maxWeight: 95 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: '2XL', minHeight: 180, maxHeight: 195, minWeight: 70, maxWeight: 100 },
  { manufacturer: 'ScubaPro', gearType: 'wetsuit', size: '3XL', minHeight: 185, maxHeight: Infinity, minWeight: 80, maxWeight: Infinity },
];

export const SCUBAPRO_BCDS: GearSizingEntry[] = [
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'XS/S', minHeight: 150, maxHeight: 170, minWeight: 43, maxWeight: 66 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'S',    minHeight: 157, maxHeight: 170, minWeight: 54, maxWeight: 70 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'M',    minHeight: 160, maxHeight: 183, minWeight: 65, maxWeight: 85 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'L',    minHeight: 170, maxHeight: 188, minWeight: 80, maxWeight: 110 },
  { manufacturer: 'ScubaPro', gearType: 'bcd', size: 'XL/XXL', minHeight: 185, maxHeight: 199, minWeight: 100, maxWeight: 130 },
];

export const AQUALUNG_WETSUITS: GearSizingEntry[] = [
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'XS', minHeight: 155, maxHeight: 165, minWeight: 50, maxWeight: 60 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'S',  minHeight: 160, maxHeight: 170, minWeight: 55, maxWeight: 70 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'M',  minHeight: 165, maxHeight: 175, minWeight: 60, maxWeight: 80 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'ML', minHeight: 170, maxHeight: 180, minWeight: 70, maxWeight: 90 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'L',  minHeight: 175, maxHeight: 185, minWeight: 80, maxWeight: 100 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'XL', minHeight: 180, maxHeight: 190, minWeight: 90, maxWeight: 105 },
  { manufacturer: 'Aqua Lung', gearType: 'wetsuit', size: 'XXL', minHeight: 185, maxHeight: 195, minWeight: 95, maxWeight: 110 },
];

export const AQUALUNG_BCDS: GearSizingEntry[] = [
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'XS', minHeight: 150, maxHeight: 165, minWeight: 45, maxWeight: 57 },
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'S',  minHeight: 157, maxHeight: 170, minWeight: 55, maxWeight: 70 },
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'M',  minHeight: 170, maxHeight: 177, minWeight: 60, maxWeight: 80 },
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'ML', minHeight: 177, maxHeight: 182, minWeight: 73, maxWeight: 86 },
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'L',  minHeight: 182, maxHeight: 188, minWeight: 82, maxWeight: 95 },
  { manufacturer: 'Aqua Lung', gearType: 'bcd', size: 'XL', minHeight: 188, maxHeight: 195, minWeight: 88, maxWeight: 109 },
];

export const MARES_WETSUITS: GearSizingEntry[] = [
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'XS', minHeight: 155, maxHeight: 165, minWeight: 45, maxWeight: 55 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'S',  minHeight: 160, maxHeight: 170, minWeight: 55, maxWeight: 70 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'M',  minHeight: 165, maxHeight: 175, minWeight: 65, maxWeight: 80 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'L',  minHeight: 170, maxHeight: 180, minWeight: 75, maxWeight: 90 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'XL', minHeight: 175, maxHeight: 185, minWeight: 85, maxWeight: 100 },
  { manufacturer: 'Mares', gearType: 'wetsuit', size: 'XXL', minHeight: 180, maxHeight: 190, minWeight: 95, maxWeight: 110 },
];

export const MARES_BCDS: GearSizingEntry[] = [
  { manufacturer: 'Mares', gearType: 'bcd', size: 'XS', minHeight: 155, maxHeight: 165, minWeight: 50, maxWeight: 60 },
  { manufacturer: 'Mares', gearType: 'bcd', size: 'S',  minHeight: 160, maxHeight: 170, minWeight: 60, maxWeight: 75 },
  { manufacturer: 'Mares', gearType: 'bcd', size: 'M',  minHeight: 165, maxHeight: 180, minWeight: 70, maxWeight: 85 },
  { manufacturer: 'Mares', gearType: 'bcd', size: 'L',  minHeight: 175, maxHeight: 185, minWeight: 80, maxWeight: 100 },
  { manufacturer: 'Mares', gearType: 'bcd', size: 'XL', minHeight: 180, maxHeight: 195, minWeight: 95, maxWeight: 115 },
];

export const ALL_GEAR_SIZING: GearSizingEntry[] = [
  ...SCUBAPRO_WETSUITS,
  ...SCUBAPRO_BCDS,
  ...AQUALUNG_WETSUITS,
  ...AQUALUNG_BCDS,
  ...MARES_WETSUITS,
  ...MARES_BCDS,
];

export const MANUFACTURERS = ['ScubaPro', 'Aqua Lung', 'Mares'] as const;
export type Manufacturer = (typeof MANUFACTURERS)[number];

export const GEAR_TYPES = ['wetsuit', 'bcd', 'fins', 'mask', 'regulator'] as const;
export type GearType = (typeof GEAR_TYPES)[number];

export const GEAR_TYPE_LABELS: Record<GearType, string> = {
  wetsuit: 'Wetsuit',
  bcd: 'BCD',
  fins: 'Fins',
  mask: 'Mask',
  regulator: 'Regulator',
};
