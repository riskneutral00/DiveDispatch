/**
 * Toggle an item in an array: removes it if present, appends it if absent.
 * Returns a new array (no mutation).
 */
export function toggleInArray(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}
