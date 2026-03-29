/**
 * Pure language overlap scoring for backend use.
 * Lives in convex/lib/ to respect dependency direction (convex/ ← src/lib/).
 * Backend data is already in locale format (e.g. 'en-GB'), so no normalization needed.
 */

/**
 * Returns the number of customer languages the instructor can cover.
 * Simple set intersection count on raw codes.
 */
export function languageOverlap(
  instructorLangs: string[],
  customerLangs: string[],
): number {
  if (instructorLangs.length === 0 || customerLangs.length === 0) return 0
  const instructorSet = new Set(instructorLangs)
  let count = 0
  for (const lang of customerLangs) {
    if (instructorSet.has(lang)) count++
  }
  return count
}
