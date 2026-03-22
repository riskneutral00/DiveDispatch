/**
 * Pure availability filtering for resource picker dropdowns.
 * Hides fully-booked resources for a given date.
 */

export type CapacityData = Record<string, Record<string, { available: number; total: number }>>

/** Filter resource options to hide fully-booked resources for a given date. */
export function filterByAvailability(
  options: { id: string; label: string; languages?: string[]; isPreferred?: boolean }[],
  date: string,
  capacityData: CapacityData | undefined,
  inventoryMap: Record<string, string>,
): typeof options {
  // If capacity data hasn't loaded yet, show all options (graceful degradation)
  if (!capacityData) return options
  return options.filter((opt) => {
    const unitId = inventoryMap[opt.id]
    if (!unitId) return true // No inventory unit found → show (e.g., external)
    const dateCapacity = capacityData[unitId]?.[date]
    if (!dateCapacity) return true // No capacity data → assume available
    return dateCapacity.available > 0
  })
}
