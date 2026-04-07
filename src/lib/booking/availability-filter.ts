export type CapacityData = Record<string, Record<string, { available: number; total: number }>>

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
