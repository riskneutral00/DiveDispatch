/**
 * Pure availability filtering and capacity labelling for resource picker dropdowns.
 * Hides fully-booked resources for a given date, and optionally enriches labels
 * with remaining capacity (e.g. "M.V. Hug Ocean (20/50)").
 */

export type CapacityData = Record<string, Record<string, { available: number; total: number }>>

/** Filter resource options to hide fully-booked resources for a given date. */
export function filterByAvailability(
  options: { id: string; label: string; languages?: string[]; isPreferred?: boolean }[],
  date: string,
  capacityData: CapacityData | undefined,
  inventoryMap: Record<string, string>,
): typeof options {
  if (!capacityData) return options
  return options.filter((opt) => {
    const unitId = inventoryMap[opt.id]
    if (!unitId) return true
    const dateCapacity = capacityData[unitId]?.[date]
    if (!dateCapacity) return true
    return dateCapacity.available > 0
  })
}

/**
 * Appends "(available/total)" to each option's label using capacity data for `date`.
 * Falls back to the original label when capacity data is missing or still loading.
 */
export function enrichOptionsWithCapacity(
  options: { id: string; label: string; languages?: string[]; isPreferred?: boolean }[],
  date: string,
  capacityData: CapacityData | undefined,
  inventoryMap: Record<string, string>,
): typeof options {
  if (!capacityData) return options
  return options.map((opt) => {
    const unitId = inventoryMap[opt.id]
    if (!unitId) return opt
    const dateCapacity = capacityData[unitId]?.[date]
    if (!dateCapacity) return opt
    const booked = dateCapacity.total - dateCapacity.available
    return { ...opt, label: `${opt.label} (${booked}/${dateCapacity.total})` }
  })
}
