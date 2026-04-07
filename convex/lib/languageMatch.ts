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
