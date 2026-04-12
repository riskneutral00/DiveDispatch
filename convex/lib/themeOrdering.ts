/** Stable ordering for theme lists: explicit `sortOrder` first, then slug. */
export function compareThemeSortOrder(
  a: { slug: string; sortOrder?: number },
  b: { slug: string; sortOrder?: number },
): number {
  const ao = a.sortOrder ?? 9999
  const bo = b.sortOrder ?? 9999
  if (ao !== bo) return ao - bo
  return a.slug.localeCompare(b.slug)
}
