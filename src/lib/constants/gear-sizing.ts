/**
 * Re-export from convex/shared/gearSizing.
 * Single source of truth lives in convex/shared/ to satisfy the dependency
 * direction rule (convex/ <- lib/ <- components/ <- app/).
 * This file exists so client-side consumers can import from their usual path.
 */
export {
  SCUBAPRO_WETSUITS,
  SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS,
  AQUALUNG_BCDS,
  MARES_WETSUITS,
  MARES_BCDS,
  ALL_GEAR_SIZING,
  MANUFACTURERS,
  GEAR_TYPES,
  GEAR_TYPE_LABELS,
  type GearSizingEntry,
  type FinSizingEntry,
  type Manufacturer,
  type GearType,
} from '../../../convex/shared/gearSizing'
